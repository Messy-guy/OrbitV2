use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use regex::Regex;
use crate::models::{ChangedFileItem, GitState};
use crate::runtime::session_events::{redact_secrets, SessionEvent, SessionEventType};

static TEST_REGEX: OnceLock<Regex> = OnceLock::new();
static TS_ERROR_REGEX: OnceLock<Regex> = OnceLock::new();
static GIT_STATE_CACHE: Mutex<Option<HashMap<String, (Instant, GitState)>>> = Mutex::new(None);

fn get_test_regex() -> &'static Regex {
    TEST_REGEX.get_or_init(|| Regex::new(r"(?i)tests?:?\s+(\d+)\s+failed.*(\d+)\s+passed").unwrap())
}

fn get_ts_error_regex() -> &'static Regex {
    TS_ERROR_REGEX.get_or_init(|| Regex::new(r"(?m)([a-zA-Z0-9_\-\./]+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$").unwrap())
}

fn get_cached_git_state(project_path: &str) -> GitState {
    if let Ok(mut cache_guard) = GIT_STATE_CACHE.lock() {
        let map = cache_guard.get_or_insert_with(HashMap::new);
        if let Some((ts, state)) = map.get(project_path) {
            if ts.elapsed() < Duration::from_secs(5) {
                return state.clone();
            }
        }
        let fresh_state = crate::git::inspect_git_state(project_path);
        map.insert(project_path.to_string(), (Instant::now(), fresh_state.clone()));
        fresh_state
    } else {
        crate::git::inspect_git_state(project_path)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRecord {
    pub command: String,
    pub timestamp: i64,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueRecord {
    pub id: String,
    pub title: String,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
    pub code: Option<String>,
    pub severity: String, // "critical", "warning", "info"
    pub status: String,   // "open", "investigating", "resolved"
    pub first_seen_at: i64,
    pub last_seen_at: i64,
    pub occurrence_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSummary {
    pub status: String, // "passed", "failed", "running"
    pub error_count: u32,
    pub warning_count: u32,
    pub timestamp: i64,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestSummary {
    pub status: String, // "passed", "failed", "running"
    pub passed_count: u32,
    pub failed_count: u32,
    pub total_count: u32,
    pub timestamp: i64,
    pub runner: String, // "vitest", "jest", "cargo", "pytest", "npm"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectActivityState {
    pub workspace_id: String,
    pub active_agent_id: Option<String>,
    pub recent_commands: Vec<CommandRecord>,
    pub changed_files: Vec<ChangedFileItem>,
    pub recent_issues: Vec<IssueRecord>,
    pub last_build: Option<BuildSummary>,
    pub last_test: Option<TestSummary>,
    pub git_state: GitState,
    pub last_activity_at: i64,
    pub last_checkpoint_time: Option<i64>,
    pub context_freshness: u32, // 0 to 100%
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftItem {
    pub text: String,
    pub confidence: String, // "High", "Medium", "Low"
    pub source: String,     // "git", "tests", "commands", "files"
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextDraft {
    pub workspace_id: String,
    pub task_proposal: DraftItem,
    pub progress_proposals: Vec<DraftItem>,
    pub changed_files: Vec<ChangedFileItem>,
    pub active_issues: Vec<IssueRecord>,
    pub recent_decisions: Vec<DraftItem>,
    pub git_summary: String,
    pub generated_at: i64,
}

pub struct ActivityDetector {
    // In-memory activity states keyed by workspace_id
    states: Mutex<HashMap<String, ProjectActivityState>>,
}

impl ActivityDetector {
    pub fn new() -> Self {
        Self {
            states: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_state(&self, workspace_id: &str) -> ProjectActivityState {
        let mut map = self.states.lock().unwrap();
        map.entry(workspace_id.to_string())
            .or_insert_with(|| ProjectActivityState {
                workspace_id: workspace_id.to_string(),
                active_agent_id: None,
                recent_commands: Vec::new(),
                changed_files: Vec::new(),
                recent_issues: Vec::new(),
                last_build: None,
                last_test: None,
                git_state: GitState::default(),
                last_activity_at: chrono::Utc::now().timestamp_millis(),
                last_checkpoint_time: None,
                context_freshness: 100,
            })
            .clone()
    }

    pub fn process_event(&self, event: &SessionEvent, _project_path: &str) {
        let mut map = self.states.lock().unwrap();
        let state = map.entry(event.workspace_id.clone()).or_insert_with(|| ProjectActivityState {
            workspace_id: event.workspace_id.clone(),
            active_agent_id: Some(event.agent_id.clone()),
            recent_commands: Vec::new(),
            changed_files: Vec::new(),
            recent_issues: Vec::new(),
            last_build: None,
            last_test: None,
            git_state: GitState::default(),
            last_activity_at: event.timestamp,
            last_checkpoint_time: None,
            context_freshness: 100,
        });

        state.active_agent_id = Some(event.agent_id.clone());
        state.last_activity_at = event.timestamp;

        match event.event_type {
            SessionEventType::UserInput => {
                if let Some(txt) = event.payload.get("text").and_then(|v| v.as_str()) {
                    let clean = redact_secrets(txt.trim());
                    if !clean.is_empty() && (clean.starts_with("npm ") || clean.starts_with("pnpm ") || clean.starts_with("cargo ") || clean.starts_with("git ") || clean.starts_with("pytest ") || clean.starts_with("node ") || clean.starts_with("python ")) {
                        state.recent_commands.push(CommandRecord {
                            command: clean,
                            timestamp: event.timestamp,
                            exit_code: None,
                            duration_ms: None,
                        });
                        if state.recent_commands.len() > 30 {
                            state.recent_commands.remove(0);
                        }
                    }
                }
            }
            SessionEventType::AgentOutput => {
                if let Some(raw_text) = event.payload.get("text").and_then(|v| v.as_str()) {
                    self.parse_technical_signals(state, raw_text, event.timestamp);
                }
            }
            _ => {}
        }
    }

    /// Refresh Git state for a workspace OUTSIDE the PTY reader hot path.
    ///
    /// This must NEVER be called from the PTY reader thread: `inspect_git_state` spawns up to
    /// four `git` subprocesses and blocks (while also holding the `states` mutex). Calling it
    /// per output chunk stalled the PTY read loop and made agent CLIs appear frozen — the
    /// primary low-end/multi-agent stall. A dedicated low-frequency background thread calls this
    /// instead, so the reader thread only ever does lock-light in-memory work.
    pub fn refresh_git_state(&self, workspace_id: &str, project_path: &str) {
        if project_path.is_empty() {
            return;
        }
        let git_st = get_cached_git_state(project_path);

        // Calculate freshness: decay based on modified files vs last checkpoint
        let uncommitted_count = git_st.modified_files.len();
        let freshness = if uncommitted_count == 0 {
            100
        } else if uncommitted_count <= 2 {
            92
        } else if uncommitted_count <= 5 {
            80
        } else if uncommitted_count <= 10 {
            65
        } else {
            45
        };

        let mut map = self.states.lock().unwrap();
        let state = map.entry(workspace_id.to_string()).or_insert_with(|| ProjectActivityState {
            workspace_id: workspace_id.to_string(),
            active_agent_id: None,
            recent_commands: Vec::new(),
            changed_files: Vec::new(),
            recent_issues: Vec::new(),
            last_build: None,
            last_test: None,
            git_state: GitState::default(),
            last_activity_at: chrono::Utc::now().timestamp_millis(),
            last_checkpoint_time: None,
            context_freshness: 100,
        });
        state.changed_files = git_st.modified_files.clone();
        state.git_state = git_st;
        state.context_freshness = freshness;
    }

    fn parse_technical_signals(&self, state: &mut ProjectActivityState, text: &str, timestamp: i64) {
        // 1. Detect Test Results (Vitest, Jest, Cargo test, Pytest)
        if text.contains("passed") || text.contains("failed") || text.contains("test result:") {
            if let Some(caps) = get_test_regex().captures(text) {
                let failed: u32 = caps[1].parse().unwrap_or(0);
                let passed: u32 = caps[2].parse().unwrap_or(0);
                state.last_test = Some(TestSummary {
                    status: if failed > 0 { "failed".to_string() } else { "passed".to_string() },
                    passed_count: passed,
                    failed_count: failed,
                    total_count: passed + failed,
                    timestamp,
                    runner: "vitest/jest".to_string(),
                });
            } else if text.contains("test result: ok") || text.contains("test result: FAILED") {
                let is_fail = text.contains("FAILED");
                state.last_test = Some(TestSummary {
                    status: if is_fail { "failed".to_string() } else { "passed".to_string() },
                    passed_count: 1,
                    failed_count: if is_fail { 1 } else { 0 },
                    total_count: 1,
                    timestamp,
                    runner: "cargo".to_string(),
                });
            }
        }

        // 2. Detect TypeScript Errors (Quick check before executing regex)
        if text.contains("error TS") {
            for caps in get_ts_error_regex().captures_iter(text) {
                let file = caps.get(1).map(|m| m.as_str().to_string());
                let line: u32 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(1);
                let code = caps.get(4).map(|m| m.as_str().to_string());
                let msg = caps.get(5).map(|m| m.as_str().to_string()).unwrap_or_else(|| "TypeScript Compile Error".to_string());

                let issue_id = format!("ts-{}-{}", code.as_deref().unwrap_or("err"), line);
                if let Some(existing) = state.recent_issues.iter_mut().find(|i| i.id == issue_id) {
                    existing.last_seen_at = timestamp;
                    existing.occurrence_count += 1;
                    existing.status = "open".to_string();
                } else {
                    state.recent_issues.push(IssueRecord {
                        id: issue_id,
                        title: msg,
                        file_path: file,
                        line_number: Some(line),
                        code,
                        severity: "critical".to_string(),
                        status: "open".to_string(),
                        first_seen_at: timestamp,
                        last_seen_at: timestamp,
                        occurrence_count: 1,
                    });
                }
            }
        }

        // 3. Detect Build Success vs Failure
        if text.contains("✓ built in") || text.contains("Finished `dev` profile") || text.contains("Compiled successfully") {
            state.last_build = Some(BuildSummary {
                status: "passed".to_string(),
                error_count: 0,
                warning_count: 0,
                timestamp,
                message: Some("Build succeeded".to_string()),
            });
            // Auto-resolve open build compiler issues
            for issue in &mut state.recent_issues {
                if issue.severity == "critical" && issue.status == "open" {
                    issue.status = "resolved".to_string();
                }
            }
        } else if text.contains("error[E") || text.contains("Failed to compile") || text.contains("Build failed") {
            state.last_build = Some(BuildSummary {
                status: "failed".to_string(),
                error_count: 1,
                warning_count: 0,
                timestamp,
                message: Some("Build failed with errors".to_string()),
            });
        }
    }

    /// Generate an automatic, proposed Context Draft for user review
    pub fn generate_draft(&self, workspace_id: &str, _project_path: &str) -> ContextDraft {
        let state = self.get_state(workspace_id);
        let now = chrono::Utc::now().timestamp_millis();

        // 1. Task Proposal: Infer from active Git branch or latest user command
        let branch_name = &state.git_state.current_branch;
        let task_text = if !branch_name.is_empty() && branch_name != "main" && branch_name != "master" {
            format!("Feature/Task on branch `{}`", branch_name)
        } else if let Some(last_cmd) = state.recent_commands.last() {
            format!("Development activity around `{}`", last_cmd.command)
        } else {
            "Active workspace development".to_string()
        };

        let task_proposal = DraftItem {
            text: task_text,
            confidence: "High".to_string(),
            source: "git/commands".to_string(),
            confirmed: false,
        };

        // 2. Progress Proposals: Derived from modified modules, tests, and builds
        let mut progress_proposals = Vec::new();
        if let Some(test) = &state.last_test {
            progress_proposals.push(DraftItem {
                text: format!("Test Suite: {} passed, {} failed", test.passed_count, test.failed_count),
                confidence: "High".to_string(),
                source: "tests".to_string(),
                confirmed: false,
            });
        }
        if let Some(build) = &state.last_build {
            progress_proposals.push(DraftItem {
                text: format!("Build Status: {}", build.status),
                confidence: "High".to_string(),
                source: "build".to_string(),
                confirmed: false,
            });
        }
        if !state.changed_files.is_empty() {
            let files_summary = state.changed_files.iter().take(4).map(|f| f.path.as_str()).collect::<Vec<_>>().join(", ");
            progress_proposals.push(DraftItem {
                text: format!("Modified {} files: {}", state.changed_files.len(), files_summary),
                confidence: "High".to_string(),
                source: "git".to_string(),
                confirmed: false,
            });
        }

        // 3. Active Issues (Failing tests or unresolved compiler errors)
        let active_issues = state.recent_issues.iter().filter(|i| i.status != "resolved").cloned().collect();

        // 4. Git Summary
        let git_summary = format!(
            "Branch `{}` with {} modified files",
            if state.git_state.current_branch.is_empty() { "main" } else { &state.git_state.current_branch },
            state.changed_files.len()
        );

        ContextDraft {
            workspace_id: workspace_id.to_string(),
            task_proposal,
            progress_proposals,
            changed_files: state.changed_files,
            active_issues,
            recent_decisions: Vec::new(),
            git_summary,
            generated_at: now,
        }
    }
}
