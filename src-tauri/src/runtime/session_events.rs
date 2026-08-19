use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

static EVENT_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SessionEventType {
    UserInput,
    AgentOutput,
    ProcessStarted,
    ProcessExited,
    CommandExecuted,
    BuildResult,
    TestResult,
    FileModified,
    Interrupted,
    TerminalResized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub id: String,
    pub session_id: String,
    pub agent_id: String,
    pub workspace_id: String,
    pub event_type: SessionEventType,
    pub payload: serde_json::Value,
    pub timestamp: i64,
}

impl SessionEvent {
    pub fn new(
        session_id: impl Into<String>,
        agent_id: impl Into<String>,
        workspace_id: impl Into<String>,
        event_type: SessionEventType,
        payload: serde_json::Value,
    ) -> Self {
        let count = EVENT_COUNTER.fetch_add(1, Ordering::Relaxed);
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            id: format!("evt-{now}-{count}"),
            session_id: session_id.into(),
            agent_id: agent_id.into(),
            workspace_id: workspace_id.into(),
            event_type,
            payload,
            timestamp: now,
        }
    }
}

/// Scrub sensitive tokens, passwords, and private keys from strings
pub fn redact_secrets(input: &str) -> String {
    let mut scrubbed = input.to_string();

    // 1. OpenAI, Anthropic, Gemini API Keys
    let api_key_patterns = [
        r"sk-[a-zA-Z0-9_-]{20,}",
        r"AIza[0-9A-Za-z-_]{35}",
        r"ghp_[a-zA-Z0-9]{36}",
        r"github_pat_[a-zA-Z0-9_]{82}",
        r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}",
    ];

    for pat in api_key_patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            scrubbed = re.replace_all(&scrubbed, "[REDACTED_API_KEY]").to_string();
        }
    }

    // 2. Generic Password / Token flags in CLI commands (e.g. --password=xyz, -p xyz)
    if let Ok(re) = regex::Regex::new(r"(?i)(password|passwd|token|secret|api_key|apikey)[=:\s]+([^\s]+)") {
        scrubbed = re.replace_all(&scrubbed, "$1=[REDACTED]").to_string();
    }

    scrubbed
}
