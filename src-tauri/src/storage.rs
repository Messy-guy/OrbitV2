use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::git::inspect_git_state;
use crate::models::{
    Agent, Checkpoint, HandoffRecord, ProjectContext, Session, Workspace,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrbitState {
    pub workspaces: Vec<Workspace>,
    pub agents: Vec<Agent>,
    pub sessions: Vec<Session>,
    pub checkpoints: Vec<Checkpoint>,
    pub project_contexts: Vec<ProjectContext>,
    pub handoffs: Vec<HandoffRecord>,
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
                Ok(content) => serde_json::from_str::<OrbitState>(&content).unwrap_or_else(|_| Self::default_state()),
                Err(_) => Self::default_state(),
            }
        } else {
            let def = Self::default_state();
            let _ = fs::write(&file_path, serde_json::to_string_pretty(&def).unwrap_or_default());
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
            .unwrap_or_else(|_| "/home/leo/Desktop/personal_projects/OrbitV2".to_string());

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
        }
    }

    pub fn save(&self) {
        if let Ok(state) = self.state.lock() {
            if let Ok(serialized) = serde_json::to_string_pretty(&*state) {
                let _ = fs::write(&self.file_path, serialized);
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
        let slug = name.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "-");
        let id = format!("ws-{}-{}", slug, now % 10000);

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
        state.agents.iter().filter(|a| a.workspace_id == workspace_id).cloned().collect()
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
        state.sessions.iter().filter(|s| s.workspace_id == workspace_id).cloned().collect()
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
        state.checkpoints.iter().filter(|c| c.workspace_id == workspace_id).cloned().collect()
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
        state.project_contexts.iter().find(|ctx| ctx.workspace_id == workspace_id).cloned()
    }

    pub fn save_project_context(&self, context: ProjectContext) {
        {
            let mut state = self.state.lock().unwrap();
            if let Some(pos) = state.project_contexts.iter().position(|ctx| ctx.workspace_id == context.workspace_id) {
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
        state.handoffs.iter().filter(|h| h.workspace_id == workspace_id).cloned().collect()
    }

    pub fn record_handoff(&self, handoff: HandoffRecord) {
        {
            let mut state = self.state.lock().unwrap();
            state.handoffs.insert(0, handoff);
        }
        self.save();
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
