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
    pub status: String, // "modified", "added", "deleted", "untracked", "renamed"
    #[serde(default)]
    pub staged: bool,
    #[serde(default)]
    pub unstaged: bool,
    #[serde(default)]
    pub is_untracked: bool,
    #[serde(default)]
    pub diff_snippet: Option<String>,
    #[serde(default)]
    pub verification_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEditSummary {
    pub file_path: String,
    pub status: String,
    #[serde(default)]
    pub additions: usize,
    #[serde(default)]
    pub deletions: usize,
    pub summary: String,
    pub diff_snippet: Option<String>,
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
    #[serde(default)]
    pub current_branch: String,
    #[serde(default)]
    pub head_commit: String,
    #[serde(default)]
    pub modified_files: Vec<ChangedFileItem>,
    #[serde(default)]
    pub staged_files: Vec<ChangedFileItem>,
    #[serde(default)]
    pub unstaged_files: Vec<ChangedFileItem>,
    #[serde(default)]
    pub untracked_files: Vec<ChangedFileItem>,
    #[serde(default)]
    pub recent_commits: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileDiffData {
    pub file_path: String,
    pub original_content: String,
    pub modified_content: String,
    pub diff: String,
    pub status: String,
    pub is_staged: bool,
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
    #[serde(default)]
    pub schema_version: u32,
    pub source_agent: String,
    pub source_session_id: String,
    pub target_agent: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub project_path: String,
    #[serde(default)]
    pub checkpoint_id: Option<String>,
    #[serde(default)]
    pub current_task: String,
    #[serde(default)]
    pub progress: String,
    #[serde(default)]
    pub decisions: Vec<String>,
    #[serde(default)]
    pub changed_files: Vec<ChangedFileItem>,
    #[serde(default)]
    pub file_summaries: Option<Vec<FileEditSummary>>,
    #[serde(default)]
    pub known_issues: Vec<String>,
    #[serde(default)]
    pub git_state: Option<GitState>,
    #[serde(default)]
    pub relevant_history: Option<Vec<String>>,
    #[serde(default)]
    pub patterns: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<Vec<String>>,
    #[serde(default)]
    pub generated_at: i64,
    #[serde(default)]
    pub estimated_tokens: usize,
    #[serde(default)]
    pub formatted_instruction: Option<String>,
    #[serde(default)]
    pub handoff_package: Option<serde_json::Value>,
}

fn default_handoff_status() -> String {
    "created".to_string()
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
    #[serde(default)]
    pub target_session_id: Option<String>,
    #[serde(default)]
    pub checkpoint_id: Option<String>,
    #[serde(default)]
    pub task: String,
    pub context_package: ContextPackage,
    #[serde(default = "default_handoff_status")]
    pub status: String, // "created", "sent", "accepted", "failed"
    #[serde(default)]
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handoff_record_deserialization_with_omitted_collections() {
        let json_str = r#"{
            "id": "rec-123",
            "workspaceId": "ws-123",
            "sourceAgentId": "agent-a",
            "sourceAgentName": "Agent A",
            "targetAgentId": "agent-b",
            "targetAgentName": "Agent B",
            "sourceSessionId": "sess-a",
            "task": "Dogfood test",
            "contextPackage": {
                "sourceAgent": "agent-a",
                "sourceSessionId": "sess-a",
                "targetAgent": "agent-b",
                "workspaceId": "ws-123",
                "workspaceName": "OrbitV2",
                "projectPath": "/path/to/project",
                "currentTask": "Dogfood test",
                "progress": "50%",
                "gitState": {
                    "currentBranch": "main",
                    "headCommit": "abc1234"
                }
            }
        }"#;

        let record: Result<HandoffRecord, _> = serde_json::from_str(json_str);
        assert!(record.is_ok(), "Failed to deserialize HandoffRecord: {:?}", record.err());
        let r = record.unwrap();
        assert_eq!(r.id, "rec-123");
        assert_eq!(r.status, "created");
        let git_state = r.context_package.git_state.expect("git_state should be present");
        assert_eq!(git_state.current_branch, "main");
        assert_eq!(git_state.head_commit, "abc1234");
        assert!(git_state.staged_files.is_empty());
        assert!(git_state.unstaged_files.is_empty());
        assert!(git_state.untracked_files.is_empty());
        assert!(git_state.recent_commits.is_empty());
    }
}
