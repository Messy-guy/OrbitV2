use crate::git::inspect_git_state;
use crate::models::{Agent, Checkpoint, HandoffRecord, ProjectContext, Session, Workspace};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrbitState {
    pub workspaces: Vec<Workspace>,
    pub agents: Vec<Agent>,
    pub sessions: Vec<Session>,
    pub checkpoints: Vec<Checkpoint>,
    pub project_contexts: Vec<ProjectContext>,
    pub handoffs: Vec<HandoffRecord>,
    #[serde(default)]
    pub profiles: Vec<String>,
}

pub struct StorageManager {
    file_path: PathBuf,
    state: Mutex<OrbitState>,
}

impl StorageManager {
    pub fn new() -> Self {
        let config_dir = dirs_or_fallback();
        if !config_dir.exists() {
            let _ = fs::create_dir_all(&config_dir);
        }
        let file_path = config_dir.join("orbit_state.json");

        let initial_state = if file_path.is_file() {
            match fs::read_to_string(&file_path) {
                Ok(content) => serde_json::from_str::<OrbitState>(&content)
                    .unwrap_or_else(|_| Self::default_state()),
                Err(_) => Self::default_state(),
            }
        } else {
            let def = Self::default_state();
            let _ = fs::write(
                &file_path,
                serde_json::to_string_pretty(&def).unwrap_or_default(),
            );
            def
        };

        Self {
            file_path,
            state: Mutex::new(initial_state),
        }
    }

    fn default_state() -> OrbitState {
        let now = chrono_now_millis();
        let current_dir = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/tmp".to_string());

        let project_name = std::path::Path::new(&current_dir)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Orbit Project".to_string());

        let git = inspect_git_state(&current_dir);

        let default_workspace = Workspace {
            id: "ws-primary".to_string(),
            name: project_name.clone(),
            project_path: current_dir.clone(),
            agent_count: Some(0),
            last_active: "Active now".to_string(),
            created_at: now,
            updated_at: now,
        };

        let default_context = ProjectContext {
            id: "ctx-primary".to_string(),
            workspace_id: "ws-primary".to_string(),
            current_task: "Develop and iterate on project features".to_string(),
            goal: format!("Active development for {}", project_name),
            progress: 10,
            active_work: format!("Branch: {}", git.current_branch),
            decisions: vec![],
            issues: vec![],
            notes: vec![],
            architecture: "Local workspace project".to_string(),
            relevant_files: git.modified_files.into_iter().map(|f| f.path).collect(),
            last_checkpoint_time: None,
            updated_at: now,
        };

        OrbitState {
            workspaces: vec![default_workspace],
            agents: vec![],
            sessions: vec![],
            checkpoints: vec![],
            project_contexts: vec![default_context],
            handoffs: vec![],
            profiles: vec!["default".to_string()],
        }
    }

    pub fn save(&self) {
        if let Ok(state) = self.state.lock() {
            if let Ok(serialized) = serde_json::to_string_pretty(&*state) {
                let tmp_path = self.file_path.with_extension("json.tmp");
                if fs::write(&tmp_path, &serialized).is_ok() {
                    let _ = fs::rename(&tmp_path, &self.file_path);
                }
            }
        }
    }

    // Workspaces
    pub fn get_workspaces(&self) -> Vec<Workspace> {
        let state = self.state.lock().unwrap();
        state.workspaces.clone()
    }

    pub fn add_workspace(&self, name: String, project_path: String) -> Workspace {
        let now = chrono_now_millis();
        let slug = name
            .to_lowercase()
            .replace(|c: char| !c.is_alphanumeric(), "-");
        let id = format!("ws-{}-{}", slug, now % 10000);

        if !project_path.trim().is_empty() {
            let _ = std::fs::create_dir_all(&project_path);
        }

        let ws = Workspace {
            id,
            name,
            project_path,
            agent_count: Some(0),
            last_active: "Just now".to_string(),
            created_at: now,
            updated_at: now,
        };

        {
            let mut state = self.state.lock().unwrap();
            state.workspaces.insert(0, ws.clone());
        }
        self.save();
        ws
    }

    pub fn delete_workspace(&self, id: &str) {
        {
            let mut state = self.state.lock().unwrap();
            state.workspaces.retain(|w| w.id != id);
            state.agents.retain(|a| a.workspace_id != id);
            state.sessions.retain(|s| s.workspace_id != id);
            state.checkpoints.retain(|c| c.workspace_id != id);
            state.project_contexts.retain(|ctx| ctx.workspace_id != id);
            state.handoffs.retain(|h| h.workspace_id != id);
        }
        self.save();
    }

    // Agents
    pub fn get_agents(&self, workspace_id: &str) -> Vec<Agent> {
        let state = self.state.lock().unwrap();
        state
            .agents
            .iter()
            .filter(|a| a.workspace_id == workspace_id)
            .cloned()
            .collect()
    }

    pub fn save_agent(&self, agent: Agent) {
        {
            let mut state = self.state.lock().unwrap();
            if let Some(pos) = state.agents.iter().position(|a| a.id == agent.id) {
                state.agents[pos] = agent;
            } else {
                state.agents.push(agent);
            }
        }
        self.save();
    }

    pub fn delete_agent(&self, agent_id: &str) {
        {
            let mut state = self.state.lock().unwrap();
            state.agents.retain(|a| a.id != agent_id);
            state.sessions.retain(|s| s.agent_id != agent_id);
        }
        self.save();
    }

    // Sessions
    pub fn get_sessions(&self, workspace_id: &str) -> Vec<Session> {
        let state = self.state.lock().unwrap();
        state
            .sessions
            .iter()
            .filter(|s| s.workspace_id == workspace_id)
            .cloned()
            .collect()
    }

    pub fn add_session(&self, session: Session) {
        {
            let mut state = self.state.lock().unwrap();
            state.sessions.insert(0, session);
        }
        self.save();
    }

    // Checkpoints
    pub fn get_checkpoints(&self, workspace_id: &str) -> Vec<Checkpoint> {
        let state = self.state.lock().unwrap();
        state
            .checkpoints
            .iter()
            .filter(|c| c.workspace_id == workspace_id)
            .cloned()
            .collect()
    }

    pub fn save_checkpoint(&self, checkpoint: Checkpoint) {
        {
            let mut state = self.state.lock().unwrap();
            if let Some(pos) = state.checkpoints.iter().position(|c| c.id == checkpoint.id) {
                state.checkpoints[pos] = checkpoint;
            } else {
                state.checkpoints.insert(0, checkpoint);
            }
        }
        self.save();
    }

    pub fn delete_checkpoint(&self, id: &str) {
        {
            let mut state = self.state.lock().unwrap();
            state.checkpoints.retain(|c| c.id != id);
        }
        self.save();
    }

    // Project Context
    pub fn get_project_context(&self, workspace_id: &str) -> Option<ProjectContext> {
        let state = self.state.lock().unwrap();
        state
            .project_contexts
            .iter()
            .find(|ctx| ctx.workspace_id == workspace_id)
            .cloned()
    }

    pub fn save_project_context(&self, context: ProjectContext) {
        {
            let mut state = self.state.lock().unwrap();
            if let Some(pos) = state
                .project_contexts
                .iter()
                .position(|ctx| ctx.workspace_id == context.workspace_id)
            {
                state.project_contexts[pos] = context;
            } else {
                state.project_contexts.push(context);
            }
        }
        self.save();
    }

    // Handoff History
    pub fn get_handoff_history(&self, workspace_id: &str) -> Vec<HandoffRecord> {
        let state = self.state.lock().unwrap();
        state
            .handoffs
            .iter()
            .filter(|h| h.workspace_id == workspace_id)
            .cloned()
            .collect()
    }

    pub fn record_handoff(&self, handoff: HandoffRecord) {
        {
            let mut state = self.state.lock().unwrap();
            state.handoffs.insert(0, handoff);
        }
        self.save();
    }

    // Profiles
    pub fn get_profiles(&self) -> Vec<String> {
        let mut set = std::collections::BTreeSet::new();
        set.insert("default".to_string());

        // 1. Stored profiles & active agent profiles
        {
            let state = self.state.lock().unwrap();
            for p in &state.profiles {
                let clean = p.trim().to_lowercase();
                if !clean.is_empty() {
                    set.insert(clean);
                }
            }
            for a in &state.agents {
                if let Some(ref prof) = a.profile_id {
                    let clean = prof.trim().to_lowercase();
                    if !clean.is_empty() {
                        set.insert(clean);
                    }
                }
            }
        }

        // 2. Discover existing profile directories on host filesystem (~/.orbit/profiles/*)
        if let Ok(home) = std::env::var("HOME") {
            let profiles_dir = PathBuf::from(home).join(".orbit").join("profiles");
            if let Ok(entries) = fs::read_dir(&profiles_dir) {
                for entry in entries.flatten() {
                    if let Ok(ft) = entry.file_type() {
                        if ft.is_dir() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            if !name.starts_with('.') && !name.starts_with("agent-") {
                                set.insert(name.to_lowercase());
                            }
                        }
                    }
                }
            }
        }

        set.into_iter().collect()
    }

    pub fn save_profile(&self, profile: &str) -> Result<String, String> {
        let clean = profile.trim().to_lowercase();
        if clean.is_empty() {
            return Err("Profile name cannot be empty".to_string());
        }
        if !clean.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err("Profile name can only contain alphanumeric characters, hyphens, and underscores".to_string());
        }

        // Prepare directory structure under ~/.orbit/profiles/<clean>
        if let Ok(home) = std::env::var("HOME") {
            let profile_root = PathBuf::from(home).join(".orbit").join("profiles").join(&clean);
            let gemini_dir = profile_root.join(".gemini");
            let config_dir = profile_root.join(".config");
            let data_dir = profile_root.join(".local").join("share");
            for directory in [&profile_root, &gemini_dir, &config_dir, &data_dir] {
                let _ = fs::create_dir_all(directory);
            }
        }

        {
            let mut state = self.state.lock().unwrap();
            if !state.profiles.iter().any(|p| p.eq_ignore_ascii_case(&clean)) {
                state.profiles.push(clean.clone());
            }
        }
        self.save();
        Ok(clean)
    }

    pub fn delete_profile(&self, profile: &str) -> Result<(), String> {
        let clean = profile.trim().to_lowercase();
        if clean == "default" {
            return Err("Cannot delete default profile".to_string());
        }
        {
            let mut state = self.state.lock().unwrap();
            state.profiles.retain(|p| !p.eq_ignore_ascii_case(&clean));
        }
        self.save();
        Ok(())
    }
}

fn dirs_or_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".config").join("orbit")
    } else {
        PathBuf::from("./orbit_data")
    }
}

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
