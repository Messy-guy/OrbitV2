use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedAgent {
    pub provider: String,
    pub name: String,
    pub path: String,
    pub version: Option<String>,
    pub is_available: bool,
    pub description: String,
    #[serde(default)]
    pub installation_source: Option<String>,
    #[serde(default)]
    pub installed_by_orbit: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub agent_count: Option<usize>,
    pub last_active: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsageStats {
    pub provider: String,
    pub active_tokens: usize,
    pub max_context_tokens: usize,
    pub percentage_used: f32,
    pub transcript_turns: usize,
    pub estimated_cost_usd: f32,
    pub last_updated: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub workspace_id: String,
    pub space_id: Option<String>,
    pub provider: String,
    pub name: String,
    pub model: String,
    pub profile_id: Option<String>,
    pub status: String, // "ready", "working", "paused", "error", "stopped"
    pub current_session_id: Option<String>,
    pub view_mode: Option<String>,
    pub pid: Option<u32>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub agent_id: String,
    pub workspace_id: String,
    pub title: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: Option<usize>,
    pub last_activity_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFileItem {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "untracked"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct GitBranchItem {
    pub name: String,
    pub is_current: bool,
    pub last_commit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    pub current_branch: String,
    pub head_commit: String,
    pub modified_files: Vec<ChangedFileItem>,
    pub recent_commits: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub task: String,
    pub progress: String,
    pub decisions: Vec<String>,
    pub known_issues: Vec<String>,
    pub notes: Option<String>,
    pub changed_files: Vec<ChangedFileItem>,
    pub agent_id: Option<String>,
    pub agent_name: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDecision {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub timestamp: String,
    pub author_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIssue {
    pub id: String,
    pub title: String,
    pub severity: String, // "critical", "warning", "info"
    pub status: String,   // "open", "investigating", "resolved"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContext {
    pub id: String,
    pub workspace_id: String,
    pub current_task: String,
    pub goal: String,
    pub progress: u32, // 0 to 100
    pub active_work: String,
    pub decisions: Vec<ProjectDecision>,
    pub issues: Vec<ProjectIssue>,
    pub notes: Vec<String>,
    pub architecture: String,
    pub relevant_files: Vec<String>,
    pub last_checkpoint_time: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextPackage {
    pub schema_version: u32,
    pub source_agent: String,
    pub source_session_id: String,
    pub target_agent: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub project_path: String,
    pub checkpoint_id: Option<String>,
    pub current_task: String,
    pub progress: String,
    pub decisions: Vec<String>,
    pub changed_files: Vec<ChangedFileItem>,
    pub known_issues: Vec<String>,
    pub git_state: Option<GitState>,
    pub relevant_history: Option<Vec<String>>,
    pub notes: Option<Vec<String>>,
    pub generated_at: i64,
    pub estimated_tokens: usize,
    pub formatted_instruction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandoffRecord {
    pub id: String,
    pub workspace_id: String,
    pub source_agent_id: String,
    pub source_agent_name: String,
    pub target_agent_id: String,
    pub target_agent_name: String,
    pub source_session_id: String,
    pub target_session_id: Option<String>,
    pub checkpoint_id: Option<String>,
    pub task: String,
    pub context_package: ContextPackage,
    pub status: String, // "created", "sent", "accepted", "failed"
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentOutputEvent {
    pub agent_id: String,
    pub session_id: String,
    pub stream: String,
    pub text: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusEvent {
    pub agent_id: String,
    pub session_id: Option<String>,
    pub status: String,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub message: Option<String>,
}
