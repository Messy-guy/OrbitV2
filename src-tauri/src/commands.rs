use crate::context::build_context_package;
use crate::discovery::detect_all_agents;
use crate::git::inspect_git_state;
use crate::models::{
    Agent, ChangedFileItem, Checkpoint, ContextPackage, DetectedAgent, GitFileDiffData, GitState,
    HandoffRecord, ProjectContext, Session, Workspace,
};
use crate::runtime::PtyManager;
use crate::storage::StorageManager;
use crate::terminal::diagnostics::TerminalDiagnosticsSnapshot;
use crate::terminal::protocol::ScreenSnapshot;
use crate::terminal::{TerminalEvent, TerminalService, TerminalSessionInfo};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub pty_manager: Arc<PtyManager>,
    pub storage: Arc<StorageManager>,
    pub terminal_service: Arc<TerminalService>,
}

#[tauri::command]
pub fn detect_agents() -> Vec<DetectedAgent> {
    detect_all_agents()
}

// Workspaces
#[tauri::command]
pub fn get_workspaces(state: State<'_, AppState>) -> Vec<Workspace> {
    state.storage.get_workspaces()
}

#[tauri::command]
pub fn create_workspace(
    state: State<'_, AppState>,
    name: String,
    project_path: String,
) -> Workspace {
    state.storage.add_workspace(name, project_path)
}

#[tauri::command]
pub fn open_folder_dialog() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        // PowerShell folder browser dialog on Windows
        let ps_script = "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Project Folder for Orbit Workspace'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Host $f.SelectedPath }";
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", ps_script])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_dir() {
                return Some(path_str);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Zenity / KDialog / Python Tkinter folder dialog on Linux
        if let Ok(output) = std::process::Command::new("zenity")
            .args([
                "--file-selection",
                "--directory",
                "--title=Select Project Folder for Orbit Workspace",
            ])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_dir() {
                return Some(path_str);
            }
        }

        if let Ok(output) = std::process::Command::new("kdialog")
            .args([
                "--getexistingdirectory",
                "--title",
                "Select Project Folder for Orbit Workspace",
            ])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_dir() {
                return Some(path_str);
            }
        }
    }

    None
}

#[tauri::command]
pub fn open_file_dialog(title: Option<String>) -> Option<String> {
    let dialog_title = title.unwrap_or_else(|| "Select Executable Binary".to_string());
    let safe_title = dialog_title.replace(['\'', '"', ';', '$', '`', '\r', '\n'], "");

    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = '{}'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Host $f.FileName }}",
            safe_title
        );
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_file() {
                return Some(path_str);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("zenity")
            .args(["--file-selection", &format!("--title={}", safe_title)])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_file() {
                return Some(path_str);
            }
        }

        if let Ok(output) = std::process::Command::new("kdialog")
            .args(["--getopenfilename", &format!("--title={}", safe_title)])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_file() {
                return Some(path_str);
            }
        }
    }

    None
}

#[tauri::command]
pub fn delete_workspace(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.storage.delete_workspace(&id);
    Ok(())
}

// Agents
#[tauri::command]
pub fn get_workspace_agents(state: State<'_, AppState>, workspace_id: String) -> Vec<Agent> {
    state.storage.get_agents(&workspace_id)
}

#[tauri::command]
pub fn save_agent(state: State<'_, AppState>, agent: Agent) -> Result<(), String> {
    state.storage.save_agent(agent);
    Ok(())
}

#[tauri::command]
pub async fn delete_agent(state: State<'_, AppState>, agent_id: String) -> Result<(), String> {
    let terminal_service = state.terminal_service.clone();
    let pty_manager = state.pty_manager.clone();
    let agent_id_for_stop = agent_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        terminal_service
            .stop_agent(&agent_id_for_stop)
            .map_err(|error| format!("Failed to stop native agent before deletion: {error}"))?;
        pty_manager.terminate(&agent_id_for_stop);
        Ok::<(), String>(())
    })
    .await
    .map_err(|error| format!("Failed to stop agent before deletion: {error}"))??;
    state.storage.delete_agent(&agent_id);
    Ok(())
}

// Profiles
#[tauri::command]
pub fn get_profiles(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.storage.get_profiles())
}

#[tauri::command]
pub fn save_profile(state: State<'_, AppState>, profile: String) -> Result<String, String> {
    state.storage.save_profile(&profile)
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, profile: String) -> Result<(), String> {
    state.storage.delete_profile(&profile)
}

// Sessions
#[tauri::command]
pub fn get_sessions(state: State<'_, AppState>, workspace_id: String) -> Vec<Session> {
    state.storage.get_sessions(&workspace_id)
}

#[tauri::command]
pub fn create_session(state: State<'_, AppState>, session: Session) -> Result<(), String> {
    state.storage.add_session(session);
    Ok(())
}

// PTY Runtime
// NOTE: All PTY commands run their blocking work on a background thread via
// tauri::async_runtime::spawn_blocking so the Tauri command/UI thread is never
// blocked while a native pseudo-terminal is opened, spawned, resized, or killed.
// This is the primary fix for UI stutter when many agent CLIs run at once.
#[tauri::command]
pub async fn start_agent_session(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace_path: String,
    agent_id: String,
    session_id: String,
    provider: String,
    profile_id: Option<String>,
    prompt: Option<String>,
    workspace_id: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
    role: Option<String>,
    resume: Option<bool>,
) -> Result<u32, String> {
    // Keep role state available to the existing MCP/operational-mode paths;
    // the native launcher also applies provider-specific role flags.
    if let Some(r) = role.as_deref() {
        state.pty_manager.set_role(&agent_id, r);
    }

    if !workspace_path.trim().is_empty() {
        let _ = boot_project_memory(workspace_path.clone(), None);
    }

    let terminal_service = state.terminal_service.clone();
    let rows_val = rows.unwrap_or(30);
    let cols_val = cols.unwrap_or(100);
    let _ = workspace_id;

    let _ = app.emit(
        "agent-status",
        crate::models::AgentStatusEvent {
            agent_id: agent_id.clone(),
            session_id: Some(session_id.clone()),
            status: "working".to_string(),
            phase: Some("booting".to_string()),
            pid: None,
            exit_code: None,
            message: None,
        },
    );

    // All normal starts now use the same native session that AgentTerminal
    // renders. This prevents duplicate V1/native child processes while keeping
    // the legacy command contract and remote-control writer boundary intact.
    tauri::async_runtime::spawn_blocking(move || {
        terminal_service
            .start(
                Some(app),
                session_id,
                agent_id,
                provider,
                workspace_path,
                rows_val,
                cols_val,
                role,
                profile_id,
                prompt,
                resume,
            )
            .map(|info| info.pid)
    })
    .await
    .map_err(|e| format!("Failed to spawn native terminal session: {}", e))?
}

#[tauri::command]
pub async fn send_agent_input(
    state: State<'_, AppState>,
    agent_id: String,
    session_id: String,
    input: String,
) -> Result<(), String> {
    if let Some(session) = state
        .terminal_service
        .session_for_input(&agent_id, &session_id)
    {
        return tauri::async_runtime::spawn_blocking(move || session.input(input.into_bytes()))
            .await
            .map_err(|e| format!("Failed to write native terminal input: {e}"))?;
    }
    let pty_manager = state.pty_manager.clone();
    // Send raw PTY byte stream directly as typed, supporting both agent_id and session_id lookup
    tauri::async_runtime::spawn_blocking(move || {
        pty_manager.write_with_fallback(&agent_id, &session_id, &input)
    })
    .await
    .map_err(|e| format!("Failed to write PTY input: {}", e))?
}

#[tauri::command]
pub fn set_agent_role(
    state: State<'_, AppState>,
    agent_id: String,
    role: String,
) -> Result<(), String> {
    state.pty_manager.set_role(&agent_id, &role);
    Ok(())
}

#[tauri::command]
pub fn get_agent_mcp_tools(
    state: State<'_, AppState>,
    agent_id: String,
) -> Vec<crate::mcp::McpToolDefinition> {
    let role = state.pty_manager.get_role(&agent_id);
    let mcp_mgr = crate::mcp::McpRoleManager::new();
    mcp_mgr.get_tools_for_role(&role)
}

#[tauri::command]
pub async fn resize_agent_terminal(
    state: State<'_, AppState>,
    agent_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    if let Some(session) = state
        .terminal_service
        .session_for_input(&agent_id, &agent_id)
    {
        return tauri::async_runtime::spawn_blocking(move || session.resize(rows, cols))
            .await
            .map_err(|e| format!("Failed to resize native terminal: {e}"))?;
    }
    let pty_manager = state.pty_manager.clone();
    tauri::async_runtime::spawn_blocking(move || pty_manager.resize(&agent_id, rows, cols))
        .await
        .map_err(|e| format!("Failed to resize PTY terminal: {}", e))?
}

#[tauri::command]
pub async fn interrupt_agent_session(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    if let Some(session) = state
        .terminal_service
        .session_for_agent(&agent_id)
        .filter(|session| session.is_running())
    {
        return tauri::async_runtime::spawn_blocking(move || session.interrupt())
            .await
            .map_err(|e| format!("Failed to interrupt native terminal: {e}"))?;
    }
    let pty_manager = state.pty_manager.clone();
    tauri::async_runtime::spawn_blocking(move || pty_manager.interrupt(&agent_id))
        .await
        .map_err(|e| format!("Failed to interrupt PTY session: {}", e))?
}

#[tauri::command]
pub async fn get_agent_terminal_history(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<String, String> {
    if let Some(session) = state.terminal_service.session_for_agent(&agent_id) {
        return tauri::async_runtime::spawn_blocking(move || session.history())
            .await
            .map_err(|e| format!("Failed to read native terminal history: {e}"))?;
    }
    let pty_manager = state.pty_manager.clone();
    tauri::async_runtime::spawn_blocking(move || Ok(pty_manager.get_history(&agent_id)))
        .await
        .map_err(|e| format!("Failed to read PTY history: {}", e))?
}

#[tauri::command]
pub async fn is_agent_process_running(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<bool, String> {
    if let Some(session) = state.terminal_service.session_for_agent(&agent_id) {
        if session.is_running() {
            return Ok(true);
        }
    }
    let pty_manager = state.pty_manager.clone();
    tauri::async_runtime::spawn_blocking(move || Ok(pty_manager.is_running(&agent_id)))
        .await
        .map_err(|e| format!("Failed to query PTY process state: {}", e))?
}

#[tauri::command]
pub async fn stop_agent_session(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    if state
        .terminal_service
        .session_for_agent(&agent_id)
        .is_some()
    {
        let service = state.terminal_service.clone();
        return tauri::async_runtime::spawn_blocking(move || service.stop_agent(&agent_id))
            .await
            .map_err(|e| format!("Failed to stop native terminal: {e}"))?;
    }
    let pty_manager = state.pty_manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        pty_manager.terminate(&agent_id);
        Ok(())
    })
    .await
    .map_err(|e| format!("Failed to stop PTY session: {}", e))?
}

// Native terminal commands. The established `send_agent_input` boundary is
// retained for remote control; the local renderer uses only the native
// snapshot protocol below.
#[tauri::command]
pub async fn terminal_v2_start(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    agent_id: String,
    provider: String,
    cwd: String,
    rows: Option<u16>,
    columns: Option<u16>,
    role: Option<String>,
    profile_id: Option<String>,
    prompt: Option<String>,
    resume: Option<bool>,
) -> Result<TerminalSessionInfo, String> {
    let service = state.terminal_service.clone();
    let app_for_worker = app.clone();
    let _ = app.emit(
        "agent-status",
        crate::models::AgentStatusEvent {
            agent_id: agent_id.clone(),
            session_id: Some(session_id.clone()),
            status: "working".to_string(),
            phase: Some("booting".to_string()),
            pid: None,
            exit_code: None,
            message: None,
        },
    );

    // Pre-scaffold system templates and project memory for the workspace
    let _ = boot_project_memory(cwd.clone(), None);

    let result = tauri::async_runtime::spawn_blocking(move || {

        service.start(
            Some(app_for_worker),
            session_id,
            agent_id,
            provider,
            cwd,
            rows.unwrap_or(30),
            columns.unwrap_or(100),
            role,
            profile_id,
            prompt,
            resume,
        )
    })
    .await
    .map_err(|error| format!("failed to start native terminal: {error}"))?;
    result
}

#[tauri::command]
pub fn terminal_v2_attach(
    state: State<'_, AppState>,
    session_id: String,
    channel: Channel<TerminalEvent>,
) -> Result<u64, String> {
    state.terminal_service.attach(&session_id, channel)
}

#[tauri::command]
pub fn terminal_v2_detach(
    state: State<'_, AppState>,
    session_id: String,
    subscription_id: u64,
) -> Result<(), String> {
    state.terminal_service.detach(&session_id, subscription_id)
}

#[tauri::command]
pub fn terminal_v2_snapshot(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<ScreenSnapshot, String> {
    state.terminal_service.snapshot(&session_id)
}

#[tauri::command]
pub async fn terminal_v2_input(
    state: State<'_, AppState>,
    session_id: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let service = state.terminal_service.clone();
    tauri::async_runtime::spawn_blocking(move || service.input(&session_id, bytes))
        .await
        .map_err(|error| format!("failed to send native terminal input: {error}"))?
}

#[tauri::command]
pub async fn terminal_v2_resize(
    state: State<'_, AppState>,
    session_id: String,
    rows: u16,
    columns: u16,
) -> Result<(), String> {
    let service = state.terminal_service.clone();
    tauri::async_runtime::spawn_blocking(move || service.resize(&session_id, rows, columns))
        .await
        .map_err(|error| format!("failed to resize native terminal: {error}"))?
}

#[tauri::command]
pub async fn terminal_v2_interrupt(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let service = state.terminal_service.clone();
    tauri::async_runtime::spawn_blocking(move || service.interrupt(&session_id))
        .await
        .map_err(|error| format!("failed to interrupt native terminal: {error}"))?
}

#[tauri::command]
pub async fn terminal_v2_stop(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let service = state.terminal_service.clone();
    tauri::async_runtime::spawn_blocking(move || service.stop(&session_id))
        .await
        .map_err(|error| format!("failed to stop native terminal: {error}"))?
}

#[tauri::command]
pub fn terminal_v2_diagnostics(state: State<'_, AppState>) -> TerminalDiagnosticsSnapshot {
    state.terminal_service.diagnostics_snapshot()
}

// Phase 3: Git State
#[tauri::command]
pub fn get_git_state(project_path: String) -> GitState {
    inspect_git_state(&project_path)
}

// Phase 3: Project Context
#[tauri::command]
pub fn get_project_context(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Option<ProjectContext> {
    state.storage.get_project_context(&workspace_id)
}

#[tauri::command]
pub fn save_project_context(
    state: State<'_, AppState>,
    context: ProjectContext,
) -> Result<(), String> {
    state.storage.save_project_context(context);
    Ok(())
}

// Phase 3: Checkpoints
#[tauri::command]
pub fn get_checkpoints(state: State<'_, AppState>, workspace_id: String) -> Vec<Checkpoint> {
    state.storage.get_checkpoints(&workspace_id)
}

#[tauri::command]
pub fn save_checkpoint(state: State<'_, AppState>, checkpoint: Checkpoint) -> Result<(), String> {
    state.storage.save_checkpoint(checkpoint.clone());

    // Continuous project memory sync: Append checkpoint to canonical ~/.orbit/memory/projects/<slug>/SESSION.md
    if let Some(workspace) = state.storage.get_workspaces().into_iter().find(|w| w.id == checkpoint.workspace_id) {
        let raw_slug = workspace
            .name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '-' })
            .collect::<String>();
        let trimmed = raw_slug.trim_matches('-').to_string();
        let project_slug = if trimmed.is_empty() { "default".to_string() } else { trimmed };

        let home = {
            #[cfg(windows)]
            {
                std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
            }
            #[cfg(not(windows))]
            {
                std::env::var_os("HOME").map(std::path::PathBuf::from)
            }
        }.unwrap_or_else(|| std::path::PathBuf::from("."));

        let agent_str = checkpoint.agent_name.as_deref().unwrap_or("Active Agent");
        let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
        let entry = format!(
            "\n\n### 📌 Checkpoint: {} by {} ({})\n- **Task**: {}\n- **Progress**: {}\n- **Touched Files**: {}\n- **Decisions**: {}\n- **Notes**: {}\n",
            checkpoint.name,
            agent_str,
            timestamp,
            checkpoint.task,
            checkpoint.progress,
            checkpoint.changed_files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>().join(", "),
            if checkpoint.decisions.is_empty() { "None".to_string() } else { checkpoint.decisions.join("; ") },
            checkpoint.notes.as_deref().unwrap_or("Checkpoint milestone captured.")
        );

        // 1. Append to canonical home memory
        let canonical_project_dir = home.join(".orbit").join("memory").join("projects").join(&project_slug);
        let _ = std::fs::create_dir_all(&canonical_project_dir);
        let canonical_session = canonical_project_dir.join("SESSION.md");
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&canonical_session) {
            use std::io::Write;
            let _ = file.write_all(entry.as_bytes());
        }

        // 2. Mirror to workspace .orbit if project_path is present
        if !workspace.project_path.is_empty() {
            let ws_mem_dir = std::path::Path::new(&workspace.project_path)
                .join(".orbit")
                .join("memory")
                .join("projects")
                .join(&project_slug);
            let _ = std::fs::create_dir_all(&ws_mem_dir);
            let ws_session = ws_mem_dir.join("SESSION.md");
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&ws_session) {
                use std::io::Write;
                let _ = file.write_all(entry.as_bytes());
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn delete_checkpoint(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.storage.delete_checkpoint(&id);
    Ok(())
}

// Phase 3: Handoff & Context Package
#[tauri::command]
pub fn generate_context_package(
    source_agent: String,
    source_session_id: String,
    target_agent: String,
    workspace_id: String,
    workspace_name: String,
    project_path: String,
    checkpoint_id: Option<String>,
    current_task: String,
    progress: String,
    decisions: Vec<String>,
    changed_files: Vec<ChangedFileItem>,
    known_issues: Vec<String>,
    git_state: Option<GitState>,
    relevant_history: Option<Vec<String>>,
    notes: Option<Vec<String>>,
) -> ContextPackage {
    build_context_package(
        source_agent,
        source_session_id,
        target_agent,
        workspace_id,
        workspace_name,
        project_path,
        checkpoint_id,
        current_task,
        progress,
        decisions,
        changed_files,
        known_issues,
        git_state,
        relevant_history,
        notes,
    )
}

#[tauri::command]
pub fn get_handoff_history(state: State<'_, AppState>, workspace_id: String) -> Vec<HandoffRecord> {
    state.storage.get_handoff_history(&workspace_id)
}

#[tauri::command]
pub fn record_handoff(state: State<'_, AppState>, handoff: HandoffRecord) -> Result<(), String> {
    state.storage.record_handoff(handoff);
    Ok(())
}

fn ensure_orbit_system_templates(dir: &std::path::Path) {
    let master_file = dir.join("MASTER.md");
    if !master_file.exists() {
        let content = r#"# ORBIT MASTER AGENT SYSTEM
# THE CONTINUITY PROMPT — UNIVERSAL AGENT BOOT

## WHAT HAPPENS WHEN THIS IS READ

Step 1 — DISCUSS Activates (Human Conversational Layer)
Read: ~/.orbit/system/DISCUSS.md
Strict rule: Do NOT modify code. Speak to the user first.

Step 2 — Ingest Project Memory
Read in order:
  1. ~/.orbit/memory/projects/[project-slug]/HANDOFF.md
  2. ~/.orbit/memory/projects/[project-slug]/AUDIT-INDEX.md
  3. ~/.orbit/memory/projects/[project-slug]/SESSION.md
  4. ~/.orbit/memory/projects/[project-slug]/CHANGES.md
  5. ~/.orbit/memory/projects/[project-slug]/DECISIONS.md
  6. ~/.orbit/memory/projects/[project-slug]/BUGS.md
  7. ~/.orbit/memory/projects/[project-slug]/ROADMAP.md

Step 3 — Inspect Guardrails & Safety Invariants
Read: ~/.orbit/system/TRIDEV.md, ~/.orbit/system/FILE-KEEPER.md, ~/.orbit/system/TIME-LENS.md, and ~/.orbit/system/VAULT.md
If no prior project memory exists: follow ~/.orbit/system/BOOT.md protocol to initialize memory.

Step 4 — Load Specialized Domain Protocols Based on Stack
Always:   ~/.orbit/system/TRIDEV.md + ~/.orbit/system/TIME-LENS.md
Backend:  ~/.orbit/system/FORGE.md + ~/.orbit/system/ATLAS.md
Auth:     ~/.orbit/system/VAULT.md
Realtime: ~/.orbit/system/WIRE.md + ~/.orbit/system/LIVE-OPS.md
Frontend: ~/.orbit/system/CANVAS.md + ~/.orbit/system/THEME-GUARD.md
QA/Test:  ~/.orbit/system/GHOST.md
Notify:   ~/.orbit/system/RELAY.md
Audit:    ~/.orbit/system/AUDIT.md

Step 5 — TIME-LENS Runs
Build temporal map from git history and active modifications.

Step 6 — BRAHMA Opens Session
Vision based on memory + TIME-LENS + AUDIT-INDEX.

Step 7 — The Ready Gate
Tell the user:
  - What context was inherited from the previous agent
  - The exact last request the user made in the previous session
  - The proposed immediate next step
Ask the user: "I have loaded your session memory and am ready. Shall I proceed with [Next Step], or would you like to direct me otherwise?"
STOP and WAIT for user confirmation.

---

## SESSION COMMANDS

| Say this          | What happens                           |
|-------------------|----------------------------------------|
| continue          | Load memory, resume from last point    |
| wrap session      | BRAHMA closes, CLEANER, PARAM runs     |
| run audit         | Full 11-agent audit pipeline           |
| run [agent]       | Run specific agent                     |
| use skill [name]  | Apply specific skill                   |
| new project       | Full project init (30 questions)       |
| copy skill [name] | Copy skill + memory to local project   |
| show memory       | Display current project memory         |
| show agents       | List all available agents              |
| /orbit            | Load Orbit project vision and roadmap  |

---

## TOKEN SAVING — AUDIT INDEX
Agents read AUDIT-INDEX.md first.
Only scan files with OPEN issues or NEW/MODIFIED since last audit.
Reduces context usage by ~70% on projects with audit history.
"#;
        let _ = std::fs::write(&master_file, content);
    }

    let discuss_file = dir.join("DISCUSS.md");
    if !discuss_file.exists() {
        let content = r#"# DISCUSS — CONVERSATIONAL ORCHESTRATOR
You are DISCUSS, the human-facing intelligence layer of Orbit.
You talk to the user, acknowledge project state, and route to correct agents.

## The Cardinal Rule
DO NOT TOUCH FILES UNTIL THE USER EXPLICITLY GIVES APPROVAL.
When booting from a handoff, always present a concise 3-point briefing:
1. 🎯 Inherited Mission: What the previous agent completed.
2. 💬 Verbatim Dialogue Context: What you and the previous agent were discussing.
3. 📋 Proposed Next Action: What needs to be done next.

Then ASK: "Shall I proceed with this plan, or would you like to direct me otherwise?"

## Core Routing

| User says             | DISCUSS calls                        |
|-----------------------|--------------------------------------|
| "build [feature]"     | BRAHMA, FORGE, CANVAS                |
| "fix auth/security"   | VAULT, VISHNU                        |
| "something is slow"   | SPEEDSTER or find-n-plus-one skill   |
| "run audit"           | ~/.orbit/system/AUDIT.md             |
| "check this file"     | TIME-LENS, relevant agent            |
| "messy code"          | MAHESH                               |
| "WebSocket broken"    | ~/.orbit/system/LIVE-OPS.md          |
| "design component"    | CANVAS + THEME-GUARD                 |
| "database / schema"   | ATLAS                                |
| "what was decided"    | Read DECISIONS.md                    |
| "open bugs"           | Read BUGS.md                         |
| "new project"         | ~/.orbit/system/BOOT.md              |

## Context Warning System

LIGHT — say nothing, just do it:
  Single file scan, memory read, quick question.

MEDIUM — brief warning:
  "This will scan ~[N] files, use ~20-30% context. Proceed?"

HEAVY — full warning:
  "Warning: This will scan [N] files, use ~40-70% context.
  Recommended: fresh session. Proceed anyway? (yes / start fresh)"

CRITICAL — block until confirmed:
  "This will fill your entire context window.
  Options: (1) Proceed  (2) Break into pieces  (3) Save state first"

## Memory-First Protocol
Before answering ANYTHING about current project:
  1. Check ~/.orbit/memory/projects/[name]/SESSION.md
  2. Check ~/.orbit/memory/projects/[name]/BUGS.md
  3. Check ~/.orbit/memory/projects/[name]/AUDIT-INDEX.md
If found: use it, do not re-scan. Saves 500-1000 tokens per question.
"#;
        let _ = std::fs::write(&discuss_file, content);
    }

    let tridev_file = dir.join("TRIDEV.md");
    if !tridev_file.exists() {
        let content = r#"# TRIDEV — BRAHMA + VISHNU + MAHESH
# Always active. Cannot be disabled.

## BRAHMA — THE ARCHITECT
- Opens every session with vision based on memory.
- Guards module boundaries and prevents architectural debt.
- Closes session with cumulative memory updates.

## VISHNU — THE GUARDIAN
- 15-Dimension security scan: auth guards, JWT, sanitization, secret protection.
- Absolute veto on security vulnerabilities (cannot be overridden).
- Prohibits touching .env files or logging secrets.

## MAHESH — DESTROYER OF COMPLEXITY
- 80-line function limit; 500-line file limit (decompose first).
- Zero sequential awaits when independent (use Promise.all).
- Zero unapproved npm packages or dependency bloat.
"#;
        let _ = std::fs::write(&tridev_file, content);
    }

    let file_keeper_file = dir.join("FILE-KEEPER.md");
    if !file_keeper_file.exists() {
        let content = r#"# FILE-KEEPER — FILE REGISTRY & SAFETY GATEKEEPER

## ABSOLUTE PROTECTION — HARDCODED — CANNOT BE OVERRIDDEN
NEVER TOUCH OR MODIFY UNLESS EXPLICITLY DIRECTED:
  .env*         .git/          certificates/
  credentials/  id_rsa*        *.pem / *.key

## PERMANENT MEMORY FILES
Never delete or overwrite without cumulative appending:
  ~/.orbit/memory/projects/[name]/SESSION.md
  ~/.orbit/memory/projects/[name]/DECISIONS.md
  ~/.orbit/memory/projects/[name]/BUGS.md
  ~/.orbit/memory/projects/[name]/PATTERNS.md
  ~/.orbit/memory/projects/[name]/ROADMAP.md
  ~/.orbit/memory/projects/[name]/AUDIT-INDEX.md
"#;
        let _ = std::fs::write(&file_keeper_file, content);
    }

    let boot_file = dir.join("BOOT.md");
    if !boot_file.exists() {
        let content = r#"# BOOT — ORBIT WORKSPACE INITIALIZATION
Runs when no prior project memory exists in ~/.orbit/memory/projects/<slug>/.

## Detect Situation First
Check if codebase has files:
  Empty or almost empty: NEW PROJECT
  Has code already:      EXISTING PROJECT

Ask:
"I see [N] files. Is this:
1. New project (plan and build together)
2. Existing project (scan and learn what is here)
3. Project worked on before (memory was lost)"

## PATH A — NEW PROJECT — 30 QUESTIONS
BRAHMA asks — Architecture (5 questions: purpose, users, critical flow, constraints, 3-month success)
VISHNU asks — Security (4 questions: sensitive data, roles, compliance, public vs internal API)
ATLAS asks — Data (4 questions: core entities, scale, database choice, permanent data)
FORGE asks — Backend (4 questions: framework, APIs, background jobs, realtime)
CANVAS asks — Frontend (4 questions: framework, design system, mobile, UI references)
WIRE asks — Infra (3 questions: notifications, deployment target, performance targets)
DISCUSS asks — Business & Timeline (6 questions: logic, integrations, deadline, team, notes)

Save all answers into ~/.orbit/memory/projects/[name]/SESSION.md and ROADMAP.md.

## PATH B — EXISTING PROJECT
LIGHT scan (~10% context): structure + config only (package.json, README, schema, main entrypoints)
FULL scan (~40% context): all files + initial audit
"#;
        let _ = std::fs::write(&boot_file, content);
    }

    let time_lens_file = dir.join("TIME-LENS.md");
    if !time_lens_file.exists() {
        let content = r#"# TIME-LENS — TEMPORAL ANALYSIS PROTOCOL
# Always active. Run before mutating workspace files.

1. Commit Velocity & Evolution:
   - Check `git log -n 5 --oneline` to understand recent changes.
   - Inspect git branch context and uncommitted modifications (`git status -s`).
2. Conflict & Stale State Prevention:
   - Verify that your proposed edits do not regress recently committed fixes.
   - Respect invariants established in prior session commits.
3. Minimal Surgical Diff:
   - Never regenerate entire files when a surgical edit suffices.
   - Preserve comments, exports, and surrounding indentation.
"#;
        let _ = std::fs::write(&time_lens_file, content);
    }

    let vault_file = dir.join("VAULT.md");
    if !vault_file.exists() {
        let content = r#"# VAULT — CREDENTIAL & SECRET CONTAINMENT PROTOCOL
# Hardcoded safety barrier. Cannot be overridden.

1. Protected Targets:
   - .env*, credentials/, id_rsa*, *.pem, *.key, service-account*.json.
2. Redaction Invariants:
   - Never log, stream, or echo secret tokens into terminal outputs or memory files.
   - Replace any detected credential in diffs or handoff briefs with [REDACTED BY ORBIT FILE-KEEPER / VISHNU SHIELD].
3. Safe Local Environment:
   - Read system environment variables via secure runtime bindings only when explicitly instructed.
"#;
        let _ = std::fs::write(&vault_file, content);
    }

    let session_cleaner_file = dir.join("SESSION-CLEANER.md");
    if !session_cleaner_file.exists() {
        let content = r#"# SESSION-CLEANER — POST-SESSION HYGIENE PROTOCOL
# Cleans only transient scratch files; protects source and permanent memory.

1. Allowed for Cleanup:
   - *.tmp, *.temp, scratch scripts in designated temporary folders.
2. ABSOLUTELY PROTECTED (NEVER DELETE OR MUTATE UNPROMPTED):
   - src/, src-tauri/, package manifests (package.json, Cargo.toml).
   - Version control (.git/).
   - All Orbit memory files in ~/.orbit/memory/projects/<slug>/ (SESSION.md, DECISIONS.md, CHANGES.md, BUGS.md, PATTERNS.md, ROADMAP.md, AUDIT-INDEX.md).
"#;
        let _ = std::fs::write(&session_cleaner_file, content);
    }

    let forge_file = dir.join("FORGE.md");
    if !forge_file.exists() {
        let content = r#"# FORGE — BACKEND BUILDER
## Standards
Response format:
  Success:   { success: true, data: T, message?: string }
  Error:     { success: false, error: string, statusCode: number }
  Paginated: { success: true, data: T[], meta: { total, page, limit, totalPages } }

Checklist:
- Every public method has explicit return type.
- DTOs use class-validator / zod on every field.
- No hardcoded secrets; use config services.
- No sequential awaits where independent (use Promise.all).
- Prisma / ORM queries use select (do not over-fetch).
"#;
        let _ = std::fs::write(&forge_file, content);
    }

    let atlas_file = dir.join("ATLAS.md");
    if !atlas_file.exists() {
        let content = r#"# ATLAS — DATABASE & INFRASTRUCTURE
## Standards
1. Money Fields: ALWAYS Decimal (never Float).
2. Soft Delete: ALWAYS on important entities (deletedAt DateTime?). Filter where: { deletedAt: null }.
3. Index Rules: Index every foreign key, frequently queried WHERE, and large table ORDER BY columns.
4. Transactions: Wrap multi-table operations in transactions.
5. Docker: Version-pinned images with explicit healthchecks.
"#;
        let _ = std::fs::write(&atlas_file, content);
    }

    let canvas_file = dir.join("CANVAS.md");
    if !canvas_file.exists() {
        let content = r#"# CANVAS — UI COMPONENT DESIGNER
## Standards
1. Always implement all 4 states: loading (skeleton), error (message + retry), empty (CTA), data.
2. Never hardcode colors, spacing, or font sizes — use CSS variables / design tokens.
3. ARIA labels on interactive elements; full keyboard navigation.
4. Mobile responsive with minimum touch targets of 44px.
"#;
        let _ = std::fs::write(&canvas_file, content);
    }

    let theme_guard_file = dir.join("THEME-GUARD.md");
    if !theme_guard_file.exists() {
        let content = r#"# THEME-GUARD — DESIGN SYSTEM ENFORCER
## Identity
Watches JSX/TSX to eliminate hardcoded hex colors, raw pixel spacings, and font sizes.
Enforces project tokens: `var(--color-primary)`, Tailwind scale classes (`text-sm`, `p-4`, `rounded-lg`).
"#;
        let _ = std::fs::write(&theme_guard_file, content);
    }

    let live_ops_file = dir.join("LIVE-OPS.md");
    if !live_ops_file.exists() {
        let content = r#"# LIVE-OPS — REALTIME, WEBSOCKET, PTY & STREAMING
## 8 Known Bug Patterns & Fixes
1. Missing admin room: Include admin dashboards in multi-room emits.
2. socket.data.user not set: Assign resolved user upon connection.
3. accessToken null after bootstrap: Re-hydrate or refresh auth on page reload.
4. React Strict Mode double-mount: Use singleton module-level sockets.
5. Role string mismatch: Strict equality between DB enums and room checks.
6. Token refresh infinite loop: Add maxRetries counter and backoff.
7. Event envelope mismatch: Unwrap structured payloads resiliently.
8. EADDRINUSE port conflict: Add port cleanup to predev scripts.
"#;
        let _ = std::fs::write(&live_ops_file, content);
    }

    let ghost_file = dir.join("GHOST.md");
    if !ghost_file.exists() {
        let content = r#"# GHOST — QA & TESTING
## Standards
- No module is done until it has automated tests.
- Happy path, error path, authorization boundaries, and edge cases (empty array, nulls).
- Target coverage: Services 80%+, Controllers 70%+, Critical paths (auth, payment) 95%+.
"#;
        let _ = std::fs::write(&ghost_file, content);
    }

    let wire_file = dir.join("WIRE.md");
    if !wire_file.exists() {
        let content = r#"# WIRE — REALTIME & ASYNC
Handles: Socket.io, BullMQ, background workers, cron jobs, push notifications, webhooks.
Invariants: Named queues, exponential backoff with dead letter queues, and non-overlapping cron guards.
"#;
        let _ = std::fs::write(&wire_file, content);
    }

    let relay_file = dir.join("RELAY.md");
    if !relay_file.exists() {
        let content = r#"# RELAY — OUTBOUND NOTIFICATIONS & MESSAGING
Handles email, push notifications, SMS, in-app alerts.
Checklist: Entity identified, clear primary CTA, no raw technical IDs, validated variables before sending.
"#;
        let _ = std::fs::write(&relay_file, content);
    }

    let audit_file = dir.join("AUDIT.md");
    if !audit_file.exists() {
        let content = r#"# AUDIT — 11 AGENT AUDIT PIPELINE
1. Ghost Hunter: missing assets & broken URLs.
2. Matchmaker: broken foreign keys & dangling relationships.
3. Data Doctor: invalid schemas, zero prices, placeholder data.
4. Watchdog: business logic gaps & config oversights.
5. Speedster: performance bottlenecks, N+1 queries, sequential awaits.
6. Shield: VISHNU 15-dim security scan, secret exposures, auth guards.
7. Architect: god files (>500 lines), DRY violations, console logs.
8. Customer Voice: UX dead ends, unhandled errors, missing empty states.
9. Live Ops: WebSocket & streaming connection resilience.
10. Perfectionist: competitive benchmark & design consistency.
11. Visionary: strategic enhancements & roadmap alignment.
"#;
        let _ = std::fs::write(&audit_file, content);
    }

    let param_file = dir.join("PARAM.md");
    if !param_file.exists() {
        let content = r#"# PARAM — THE META-AGENT
Runs at the conclusion of sessions to evaluate and improve system instructions.
Jobs:
1. Agent Improvement: Rewrite underperforming instructions.
2. Failure Classification: Classify wrong assumptions or missing context.
3. Signal vs Noise: Eliminate repetitive log noise and reinforce high-signal findings.
"#;
        let _ = std::fs::write(&param_file, content);
    }

    let agents_index_file = dir.join("AGENTS-INDEX.md");
    if !agents_index_file.exists() {
        let content = r#"# COMPLETE AGENT & SKILLS REGISTRY

## TIER 1 — SYSTEM AGENTS
- MASTER.md: Universal continuity entry point
- DISCUSS.md: Conversational orchestrator & router
- BOOT.md: Workspace initialization (30 questions)
- PARAM.md: Meta-agent improving system instructions
- TIME-LENS.md: Temporal analysis & surgical diffs
- SESSION-CLEANER.md: Post-session hygiene
- FILE-KEEPER.md: Protection gatekeeper

## TIER 2 — TRIDEV (ALWAYS ACTIVE)
- BRAHMA: Architecture & session scope
- VISHNU: 15-dim security guardian (absolute veto)
- MAHESH: Destroyer of complexity & bloat

## TIER 3 — BUILD AGENTS
- FORGE.md: Backend services & API contracts
- ATLAS.md: Database, schemas, migrations
- CANVAS.md: UI component designer (4 states)
- THEME-GUARD.md: Design system & tokens enforcer
- GHOST.md: QA & automated testing
- WIRE.md: Realtime, queues, workers
- RELAY.md: Outbound notifications & email
- VAULT.md: Credential & secret containment

## TIER 4 — DOMAIN & RUNTIME
- LIVE-OPS.md: WebSockets, PTY streaming, port management
- ANIMESH.md: Orbit project vision — One Workspace. Every AI.

## TIER 5 — AUDIT SYSTEM
- AUDIT.md: 11-agent comprehensive audit pipeline
"#;
        let _ = std::fs::write(&agents_index_file, content);
    }

    let animesh_file = dir.join("ANIMESH.md");
    if !animesh_file.exists() {
        let content = r#"# ANIMESH — ORBIT PROJECT AGENT
## Motto: One Workspace. Every AI.
Orbit is the universal AI coding platform and developer workspace.
Orbit owns conversations, memory, context, workspaces, and tools.
AI engines own reasoning, code generation, planning, and responses.
"#;
        let _ = std::fs::write(&animesh_file, content);
    }
}

pub fn ensure_project_memory_scaffold(project_memory_dir: &std::path::Path, raw_name: &str, current_task: &str) {
    let _ = std::fs::create_dir_all(project_memory_dir);

    let session_file = project_memory_dir.join("SESSION.md");
    if !session_file.exists() {
        let content = format!(
            "# {} Project Memory — Cumulative Sessions\n\n> Initialized by Orbit Continuous Memory Engine.\n\n## Project Status\n- **Project**: {}\n- **Current Task**: {}\n- **Status**: Workspace initialized\n",
            raw_name, raw_name, if current_task.is_empty() { "Active Development" } else { current_task }
        );
        let _ = std::fs::write(&session_file, content);
    }

    let decisions_file = project_memory_dir.join("DECISIONS.md");
    if !decisions_file.exists() {
        let content = format!(
            "# {} Project — Architectural Decisions Record\n\n> Historical and active architectural invariants.\n",
            raw_name
        );
        let _ = std::fs::write(&decisions_file, content);
    }

    let bugs_file = project_memory_dir.join("BUGS.md");
    if !bugs_file.exists() {
        let content = format!(
            "# {} Project — Tracked Blockers & Issues\n\n> Active issues, edge cases, and known bugs.\n",
            raw_name
        );
        let _ = std::fs::write(&bugs_file, content);
    }

    let patterns_file = project_memory_dir.join("PATTERNS.md");
    if !patterns_file.exists() {
        let content = format!(
            "# {} Project — Discovered Patterns & Conventions\n\n- Strict typing, explicit error boundaries, and verified test suites.\n- Cumulative session persistence in ~/.orbit/memory/projects/.\n",
            raw_name
        );
        let _ = std::fs::write(&patterns_file, content);
    }

    let roadmap_file = project_memory_dir.join("ROADMAP.md");
    if !roadmap_file.exists() {
        let task_desc = if current_task.is_empty() { "Active core development" } else { current_task };
        let content = format!(
            "# Roadmap — {}\n\n> Multi-agent continuous roadmap maintained by Orbit.\n\n## Phase 0 — Foundation & Runtime Architecture\n- [x] Workspace initialized and project memory configured\n- [x] Multi-agent runtime & deterministic context relay operational\n\n## Phase 1 — Active Core Implementation\n- [/] {}\n- [ ] Comprehensive verification across test suites\n\n## Phase 2 — System Hardening & Integration\n- [ ] Cross-module error bounds and performance audits\n- [ ] Edge-case handling and state resilience\n\n## Phase 3 — Production Readiness\n- [ ] Clean production build (0 errors, 0 warnings)\n- [ ] Multi-platform validation and release closure\n",
            raw_name, task_desc
        );
        let _ = std::fs::write(&roadmap_file, content);
    }

    let audit_index_file = project_memory_dir.join("AUDIT-INDEX.md");
    if !audit_index_file.exists() {
        let content = format!(
            "# Audit Index — {}\n\n> Token-saving audit index maintained by Orbit.\n> Agents read this first to only scan files with OPEN issues or recent changes.\n\n## Priority 1 — Security\n- [ ] Secrets and credentials exposure audit across `.env*` and configs\n- [ ] Auth guard and permission verification on sensitive endpoints\n\n## Priority 2 — Correctness\n- [ ] State synchronization and race conditions\n- [ ] Error boundary and exception coverage\n\n## Priority 3 — Performance\n- [ ] N+1 queries and sequential awaits optimization\n- [ ] Memory leaks and uncoalesced IPC events\n\n## Priority 4 — Quality & Maintainability\n- [ ] Clean typecheck and zero build errors\n- [ ] Test coverage on critical paths\n\n## OPEN ISSUES\n| File | Line | Issue | Severity | Found | Agent |\n|---|---|---|---|---|---|\n\n## FIXED\n| File | Issue | Fixed Session |\n|---|---|---|\n\n## CLEAN FILES (skip if unchanged)\n\n## WATCH AREAS (scan first — highest bug density)\n",
            raw_name
        );
        let _ = std::fs::write(&audit_index_file, content);
    }
}

#[tauri::command]
pub fn boot_project_memory(
    project_path: String,
    workspace_name: Option<String>,
) -> Result<String, String> {
    let home = {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(std::path::PathBuf::from)
        }
    }.unwrap_or_else(|| std::path::PathBuf::from("."));

    let orbit_home_dir = home.join(".orbit");
    let orbit_system_dir = orbit_home_dir.join("system");
    let _ = std::fs::create_dir_all(&orbit_system_dir);
    ensure_orbit_system_templates(&orbit_system_dir);

    // Initialize or load structured project memory using fingerprint cache
    let stored = crate::project_memory::initialize_or_load_project_memory(&project_path, workspace_name.as_deref())?;
    let project_slug = stored.slug;
    let project_canonical_dir = crate::project_memory::get_project_canonical_dir(&project_slug);

    if !project_path.trim().is_empty() {
        let workspace_orbit_dir = std::path::Path::new(&project_path).join(".orbit");
        if let Ok(_) = std::fs::create_dir_all(&workspace_orbit_dir) {
            let continuity_pointer = workspace_orbit_dir.join("CONTINUITY.md");
            if !continuity_pointer.exists() {
                let master_abs = orbit_system_dir.join("MASTER.md").to_string_lossy().to_string();
                let pointer_content = format!(
                    "# ORBIT WORKSPACE CONTINUITY POINTER\n\n- **Project Memory**: `{}`\n- **System Manual**: `{}`\n- **Project Root**: `{}`\n- **Initial Boot Protocol**: `~/.orbit/system/BOOT.md`\n",
                    project_canonical_dir.to_string_lossy(),
                    master_abs,
                    project_path
                );
                let _ = std::fs::write(&continuity_pointer, pointer_content);
            }
        }
    }

    Ok(project_slug)
}

#[tauri::command]
pub fn append_project_event(
    project_slug: String,
    event_json: String,
) -> Result<bool, String> {
    crate::project_memory::append_event_to_ledger(&project_slug, &event_json)?;
    Ok(true)
}

#[tauri::command]
pub fn execute_agent_handoff(

    app: AppHandle,
    state: State<'_, AppState>,
    handoff: HandoffRecord,
    target_provider: String,
) -> Result<u32, String> {
    // 1. Record the handoff
    state.storage.record_handoff(handoff.clone());

    let relevant_dialogue_owned = handoff
        .context_package
        .relevant_history
        .as_ref()
        .map(|h| h.join("\n\n"))
        .unwrap_or_default();
    let relevant_dialogue = relevant_dialogue_owned.as_str();

    let handoff_content = handoff
        .context_package
        .formatted_instruction
        .as_deref()
        .unwrap_or("");

    // 2. Persist full handoff manifest & continuous project memory in ~/.orbit/memory/projects/<project_slug>/
    let home = {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(std::path::PathBuf::from)
        }
    }.unwrap_or_else(|| std::path::PathBuf::from("."));

    let orbit_home_dir = home.join(".orbit");
    let orbit_system_dir = orbit_home_dir.join("system");
    let _ = std::fs::create_dir_all(&orbit_system_dir);
    ensure_orbit_system_templates(&orbit_system_dir);

    let proj_path = &handoff.context_package.project_path;
    let raw_name = if !handoff.context_package.workspace_name.is_empty() {
        handoff.context_package.workspace_name.clone()
    } else if !proj_path.is_empty() {
        std::path::Path::new(proj_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "project".to_string())
    } else {
        "project".to_string()
    };
    let slug = raw_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '-' })
        .collect::<String>();
    let trimmed_slug = slug.trim_matches('-').to_string();
    let project_slug = if trimmed_slug.is_empty() { "default".to_string() } else { trimmed_slug };

    let project_memory_dir = orbit_home_dir.join("memory").join("projects").join(&project_slug);
    let _ = std::fs::create_dir_all(&project_memory_dir);

    let canonical_proj_dir = crate::project_memory::get_project_canonical_dir(&project_slug);
    let canonical_views_dir = canonical_proj_dir.join("views");
    let _ = std::fs::create_dir_all(&canonical_views_dir);

    let canonical_handoff_md = canonical_views_dir.join("HANDOFF.md");
    let _ = std::fs::write(&canonical_handoff_md, handoff_content);

    let canonical_handoff_json = canonical_proj_dir.join("HANDOFF.json");
    if let Ok(serialized) = serde_json::to_string_pretty(&handoff) {
        let _ = std::fs::write(&canonical_handoff_json, serialized);
    }

    // 2a. Active Project Handoff briefing file (legacy mirror)
    let project_handoff_file = project_memory_dir.join("HANDOFF.md");
    let _ = std::fs::write(&project_handoff_file, handoff_content);

    // Also mirror to root ~/.orbit/HANDOFF.md so general reference resolves immediately
    let root_handoff_file = orbit_home_dir.join("HANDOFF.md");
    let _ = std::fs::write(&root_handoff_file, handoff_content);

        // 2b. Cumulative SESSION.md memory (Rich conversational trajectory)
        let timestamp_str = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
        let session_log_entry = format!(
            "\n\n## {} — Session Handoff: {} → {}\n- **Task**: {}\n- **Progress**: {}\n- **Files Touched**: {}\n- **Decisions**: {}\n- **Blockers**: {}\n\n### Conversational Trajectory & Accomplishments:\n{}\n",
            timestamp_str,
            handoff.source_agent_name,
            handoff.target_agent_name,
            handoff.context_package.current_task,
            handoff.context_package.progress,
            handoff.context_package.changed_files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>().join(", "),
            if handoff.context_package.decisions.is_empty() { "None".to_string() } else { handoff.context_package.decisions.join("; ") },
            if handoff.context_package.known_issues.is_empty() { "None".to_string() } else { handoff.context_package.known_issues.join("; ") },
            if relevant_dialogue.is_empty() { "Continuous workflow relay." } else { relevant_dialogue }
        );

        let session_file = project_memory_dir.join("SESSION.md");
        let mut session_content = std::fs::read_to_string(&session_file)
            .unwrap_or_else(|_| format!("# {} Project Memory — Cumulative Sessions\n", raw_name));
        session_content.push_str(&session_log_entry);
        let _ = std::fs::write(&session_file, session_content);

        // 2c. Cumulative DECISIONS.md
        let decisions_file = project_memory_dir.join("DECISIONS.md");
        let mut decisions_content = std::fs::read_to_string(&decisions_file)
            .unwrap_or_else(|_| format!("# {} Project — Architectural Decisions Record\n", raw_name));
        if !handoff.context_package.decisions.is_empty() {
            for dec in &handoff.context_package.decisions {
                decisions_content
                    .push_str(&format!("\n- [{}] {}", handoff.source_agent_name, dec));
            }
        }
        let _ = std::fs::write(&decisions_file, decisions_content);

        // 2d. Cumulative BUGS.md
        let bugs_file = project_memory_dir.join("BUGS.md");
        let mut bugs_content = std::fs::read_to_string(&bugs_file)
            .unwrap_or_else(|_| format!("# {} Project — Tracked Blockers & Issues\n", raw_name));
        if !handoff.context_package.known_issues.is_empty() {
            for bug in &handoff.context_package.known_issues {
                bugs_content.push_str(&format!("\n- ⚠️ [{}] {}", handoff.source_agent_name, bug));
            }
        }
        let _ = std::fs::write(&bugs_file, bugs_content);

        // 2e. Discovered PATTERNS.md
        let patterns_file = project_memory_dir.join("PATTERNS.md");
        let mut patterns_content = std::fs::read_to_string(&patterns_file)
            .unwrap_or_else(|_| format!("# {} Project — Discovered Patterns & Conventions\n", raw_name));
        if let Some(patterns) = &handoff.context_package.patterns {
            for pat in patterns {
                patterns_content.push_str(&format!("\n- [{}] {}", handoff.source_agent_name, pat));
            }
        } else {
            patterns_content.push_str(&format!(
                "\n- [{}] Adhere strictly to project conventions, strict TypeScript typing, and verified test contracts.",
                handoff.source_agent_name
            ));
        }
        let _ = std::fs::write(&patterns_file, patterns_content);

        // 2f. Project Roadmap & Milestone Tracker (ROADMAP.md)
        let roadmap_file = project_memory_dir.join("ROADMAP.md");
        if !roadmap_file.exists() {
            let roadmap_content = format!(
                "# Roadmap — {}\n\n> Multi-agent continuous roadmap maintained by Orbit.\n\n## Phase 0 — Foundation & Runtime Architecture\n- [x] Workspace initialized and project memory configured\n- [x] Multi-agent runtime & deterministic context relay operational\n\n## Phase 1 — Active Core Implementation\n- [/] {}\n- [ ] Comprehensive verification across test suites\n\n## Phase 2 — System Hardening & Integration\n- [ ] Cross-module error bounds and performance audits\n- [ ] Edge-case handling and state resilience\n\n## Phase 3 — Production Readiness\n- [ ] Clean production build (0 errors, 0 warnings)\n- [ ] Multi-platform validation and release closure\n",
                raw_name,
                handoff.context_package.current_task
            );
            let _ = std::fs::write(&roadmap_file, roadmap_content);
        }

        // 2g. Granular File Changes & Live Unified Diffs (CHANGES.md)
        let changes_file = project_memory_dir.join("CHANGES.md");
        let mut changes_content = format!(
            "# {} Project — File Edit Summaries & Unified Diffs\n\n*Relay from {} to {}*\n\n",
            raw_name, handoff.source_agent_name, handoff.target_agent_name
        );
        let mut handled_files = std::collections::HashSet::new();

        if let Some(summaries) = &handoff.context_package.file_summaries {
            for s in summaries {
                handled_files.insert(s.file_path.clone());
                changes_content.push_str(&format!(
                    "### `{}` ({}, +{}/-{} lines)\n**Summary**: {}\n\n",
                    s.file_path, s.status, s.additions, s.deletions, s.summary
                ));
                let is_secret = s.file_path.contains(".env") || s.file_path.ends_with(".pem") || s.file_path.ends_with(".key") || s.file_path.contains("credential") || s.file_path.contains("id_rsa") || s.file_path.contains("id_ed25519") || s.file_path.contains("id_ecdsa") || s.file_path.contains("service-account") || s.file_path.ends_with(".pfx") || s.file_path.ends_with(".p12");
                if is_secret {
                    changes_content.push_str("```\n--- [REDACTED BY ORBIT FILE-KEEPER / VISHNU SHIELD] ---\n```\n\n");
                } else {
                    let diff = if let Some(d) = &s.diff_snippet {
                        if !d.trim().is_empty() {
                            d.clone()
                        } else {
                            crate::git::get_git_file_diff(proj_path, &s.file_path)
                        }
                    } else {
                        crate::git::get_git_file_diff(proj_path, &s.file_path)
                    };
                    if !diff.trim().is_empty() && diff != "No changes detected for this file." {
                        changes_content.push_str(&format!("```diff\n{}\n```\n\n", diff.trim()));
                    }
                }
            }
        }

        // Include any modified files from gitState not already covered
        for f in &handoff.context_package.changed_files {
            if !handled_files.contains(&f.path) {
                let is_secret = f.path.contains(".env") || f.path.ends_with(".pem") || f.path.ends_with(".key") || f.path.contains("credential") || f.path.contains("id_rsa") || f.path.contains("id_ed25519") || f.path.contains("id_ecdsa") || f.path.contains("service-account") || f.path.ends_with(".pfx") || f.path.ends_with(".p12");
                changes_content.push_str(&format!(
                    "### `{}` ({})\n\n",
                    f.path, f.status
                ));
                if is_secret {
                    changes_content.push_str("```\n--- [REDACTED BY ORBIT FILE-KEEPER / VISHNU SHIELD] ---\n```\n\n");
                } else {
                    let diff = crate::git::get_git_file_diff(proj_path, &f.path);
                    if !diff.trim().is_empty() && diff != "No changes detected for this file." {
                        changes_content.push_str(&format!("```diff\n{}\n```\n\n", diff.trim()));
                    }
                }
            }
        }
        let _ = std::fs::write(&changes_file, changes_content);

    let master_abs = orbit_system_dir.join("MASTER.md").to_string_lossy().to_string();
    let handoff_abs = project_handoff_file.to_string_lossy().to_string();

    // 2h. Write workspace continuity pointer (.orbit/CONTINUITY.md) in project root
    if !proj_path.is_empty() {
        let workspace_orbit_dir = std::path::Path::new(proj_path).join(".orbit");
        if let Ok(_) = std::fs::create_dir_all(&workspace_orbit_dir) {
            let continuity_pointer = workspace_orbit_dir.join("CONTINUITY.md");
            let pointer_content = format!(
                "# ORBIT WORKSPACE CONTINUITY POINTER\n\n- **Project Memory**: `{}`\n- **Current Handoff**: `{}`\n- **System Manual**: `{}`\n- **Source Agent**: {}\n- **Target Agent**: {}\n",
                project_memory_dir.to_string_lossy(),
                handoff_abs,
                master_abs,
                handoff.source_agent_name,
                handoff.target_agent_name
            );
            let _ = std::fs::write(&continuity_pointer, pointer_content);
        }
    }

    // 3. Build a dense, self-contained executive handoff prompt for Agent B.
    let (initial_goal, trajectory_summary, latest_directive) = if !relevant_dialogue.is_empty() {
        let mut user_turns: Vec<String> = Vec::new();
        let mut current_user_buf = String::new();
        let mut current_speaker_is_user = false;

        for line in relevant_dialogue.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("#### Turn") {
                if current_speaker_is_user && !current_user_buf.is_empty() {
                    user_turns.push(current_user_buf.trim().to_string());
                    current_user_buf.clear();
                }
                current_speaker_is_user = trimmed.contains("User") || trimmed.contains("👤");
                continue;
            } else if trimmed.starts_with("User:") || trimmed.starts_with("[USER DIRECTIVE]:") {
                if current_speaker_is_user && !current_user_buf.is_empty() {
                    user_turns.push(current_user_buf.trim().to_string());
                    current_user_buf.clear();
                }
                current_speaker_is_user = true;
                let clean = trimmed
                    .trim_start_matches("User:")
                    .trim_start_matches("[USER DIRECTIVE]:")
                    .trim();
                if !clean.is_empty() {
                    current_user_buf = clean.to_string();
                }
                continue;
            } else if trimmed.starts_with("• Directive") {
                if let Some(start_quote) = trimmed.find('"') {
                    if let Some(end_quote) = trimmed.rfind('"') {
                        if end_quote > start_quote {
                            let directive_text = &trimmed[start_quote + 1..end_quote];
                            if !directive_text.is_empty() {
                                user_turns.push(directive_text.to_string());
                            }
                        }
                    }
                }
                continue;
            } else if trimmed.starts_with("Agent:") || trimmed.starts_with("🤖") {
                if current_speaker_is_user && !current_user_buf.is_empty() {
                    user_turns.push(current_user_buf.trim().to_string());
                    current_user_buf.clear();
                }
                current_speaker_is_user = false;
                continue;
            }

            if current_speaker_is_user && trimmed.starts_with('>') {
                let content = trimmed.trim_start_matches('>').trim();
                if !content.is_empty() && !content.starts_with('*') {
                    if current_user_buf.is_empty() {
                        current_user_buf = content.to_string();
                    } else {
                        current_user_buf.push(' ');
                        current_user_buf.push_str(content);
                    }
                }
            }
        }

        if current_speaker_is_user && !current_user_buf.is_empty() {
            user_turns.push(current_user_buf.trim().to_string());
        }

        fn sanitize_directive_for_prompt(s: &str, max_chars: usize) -> String {
            let sanitized: String = s
                .chars()
                .map(|c| if c == '\r' || c == '\n' || c == '\t' { ' ' } else if c == '"' { '\'' } else { c })
                .collect();
            let trimmed = sanitized.trim();
            if trimmed.chars().count() > max_chars {
                let truncated: String = trimmed.chars().take(max_chars).collect();
                format!("{}...", truncated)
            } else {
                trimmed.to_string()
            }
        }

        let is_valid_goal = |s: &str| -> bool {
            let t = s.trim();
            if t.len() < 5 { return false; }
            if t.starts_with('/') { return false; }
            if t.starts_with("Working") || t.starts_with("CLI Other") || t.starts_with("Keyboard:") || t.starts_with("Conversations") { return false; }
            if t.contains("steps") && (t.contains("ago") || t.contains("items")) { return false; }
            true
        };

        let default_task = if !handoff.context_package.current_task.is_empty() && is_valid_goal(&handoff.context_package.current_task) {
            handoff.context_package.current_task.clone()
        } else {
            "Active workspace implementation and verification".to_string()
        };

        let valid_user_turns: Vec<String> = user_turns.into_iter().filter(|s| is_valid_goal(s)).collect();

        let first = valid_user_turns.first().cloned().unwrap_or_else(|| default_task.clone());
        let last = valid_user_turns.last().cloned().unwrap_or_else(|| first.clone());

        let traj = if valid_user_turns.len() > 1 {
            format!("{} user directives executed across session", valid_user_turns.len())
        } else {
            "Active task execution".to_string()
        };

        let clean_first = sanitize_directive_for_prompt(&first, 140);
        let clean_last = sanitize_directive_for_prompt(&last, 140);

        (clean_first, traj, clean_last)
    } else {
        fn sanitize_directive_for_prompt(s: &str, max_chars: usize) -> String {
            let sanitized: String = s
                .chars()
                .map(|c| if c == '\r' || c == '\n' || c == '\t' { ' ' } else if c == '"' { '\'' } else { c })
                .collect();
            let trimmed = sanitized.trim();
            if trimmed.chars().count() > max_chars {
                let truncated: String = trimmed.chars().take(max_chars).collect();
                format!("{}...", truncated)
            } else {
                trimmed.to_string()
            }
        }
        let task = if !handoff.context_package.current_task.is_empty() {
            handoff.context_package.current_task.clone()
        } else {
            "Active workspace implementation and verification".to_string()
        };
        let clean_task = sanitize_directive_for_prompt(&task, 140);
        (clean_task.clone(), "Active task execution".to_string(), clean_task)
    };

    let touched_files_str = if !handoff.context_package.changed_files.is_empty() {
        let files = handoff.context_package.changed_files
            .iter()
            .take(4)
            .map(|f| f.path.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        format!(" Active touchpoints: [{}].", files)
    } else {
        String::new()
    };

    let decisions_str = if !handoff.context_package.decisions.is_empty() {
        let d = handoff.context_package.decisions.iter().take(2).cloned().collect::<Vec<_>>().join("; ");
        format!(" Key rules: [{}].", d)
    } else {
        String::new()
    };

    let intent_prefix = if handoff_content.contains("BRAHMA TO MAHESH") || handoff_content.contains("PLAN ➔ CODE") {
        "ORBIT CODE RELAY (Plan ➔ Code)"
    } else if handoff_content.contains("VISHNU 15-DIMENSION") || handoff_content.contains("SECURITY AUDIT") {
        "ORBIT SECURITY AUDIT (Vishnu 15-Dim)"
    } else {
        "ORBIT CONTEXT RELAY (Resume Chat)"
    };

    let tech_stack_summary = if let Ok(mem) = crate::project_memory::initialize_or_load_project_memory(proj_path, Some(&raw_name)) {
        if !mem.tech_stack.is_empty() {
            mem.tech_stack.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", ")
        } else {
            "TypeScript / Rust".to_string()
        }
    } else {
        "TypeScript / Rust".to_string()
    };

    let active_task = if !latest_directive.is_empty() {
        latest_directive.clone()
    } else if !handoff.context_package.current_task.is_empty() {
        handoff.context_package.current_task.clone()
    } else {
        "Active workspace implementation and verification".to_string()
    };

    let next_action = "Inspect active touched files and continue implementation from prior state.".to_string();

    let concise_prompt = format!(
        "ORBIT CONTINUITY: You have the available project engineering context in HANDOFF.json, HANDOFF.md, and SESSION.md. Project: {} | Tech: {} | Active Task: {} | Immediate Next Action: {} RULE: Follow DISCUSS protocol. Do not ask for background that is already represented in the handoff. If required information is genuinely absent to perform the next action, identify exactly what is missing. Do NOT modify files yet. Greet the user, summarize the engineering state and what was accomplished, state your immediate next action, and ask for confirmation to proceed.",
        raw_name,
        tech_stack_summary,
        active_task,
        next_action
    );


    // 4. If the target agent session is ALREADY running — write directly to its stdin.
    //    Never kill a live session during a handoff.
    if let Some(session) = state
        .terminal_service
        .session_for_agent(&handoff.target_agent_id)
        .filter(|session| session.is_running())
    {
        match session.input(format!("{}\r", concise_prompt).into_bytes()) {
            Ok(_) => return Ok(session.info.pid),
            Err(e) => {
                eprintln!("[ORBIT HANDOFF] Input to running session failed: {e}. Falling back to fresh start.");
            }
        }
    }
    if state.pty_manager.is_running(&handoff.target_agent_id) {
        // Append \r so TUI agents (Ink, readline) submit the input immediately
        let _ = state
            .pty_manager
            .write(&handoff.target_agent_id, &format!("{}\r", concise_prompt));
        return Ok(0);
    }

    // 5. Target is NOT running — spawn a fresh interactive session WITHOUT a prompt.
    //    Passing prompt=None means create_session will NOT kill any existing session
    //    and the TUI mounts cleanly. We then deliver the prompt via a delayed write,
    //    giving the TUI time to fully initialize before receiving any input.
    let target_session_id = handoff.target_session_id.unwrap_or_else(|| {
        format!(
            "sess-{}-{}",
            handoff.target_agent_id,
            chrono_now_millis() % 10000
        )
    });

    // The native session owns the startup delay and prompt write. This keeps
    // handoff launches on the same PTY/emulator/input path as AgentTerminal.
    let info = state.terminal_service.start(
        Some(app),
        target_session_id,
        handoff.target_agent_id.clone(),
        target_provider,
        handoff.context_package.project_path.clone(),
        30,
        100,
        None,
        None,
        Some(concise_prompt),
        None,
    )?;

    Ok(info.pid)
}

// Phase 4 Intelligent Context Commands
#[tauri::command]
pub fn get_project_activity(
    state: State<'_, AppState>,
    workspace_id: String,
) -> crate::runtime::ProjectActivityState {
    state.pty_manager.activity_detector.get_state(&workspace_id)
}

#[tauri::command]
pub fn generate_context_draft(
    state: State<'_, AppState>,
    workspace_id: String,
    project_path: String,
) -> crate::runtime::ContextDraft {
    state
        .pty_manager
        .activity_detector
        .generate_draft(&workspace_id, &project_path)
}

#[tauri::command]
pub fn apply_context_draft(
    state: State<'_, AppState>,
    workspace_id: String,
    current_task: String,
    progress: u32,
    active_work: String,
) -> Result<ProjectContext, String> {
    let mut ctx = state
        .storage
        .get_project_context(&workspace_id)
        .unwrap_or_else(|| ProjectContext {
            id: format!("ctx-{}", &workspace_id),
            workspace_id: workspace_id.clone(),
            current_task: String::new(),
            goal: String::new(),
            progress: 0,
            active_work: String::new(),
            decisions: Vec::new(),
            issues: Vec::new(),
            notes: Vec::new(),
            architecture: String::new(),
            relevant_files: Vec::new(),
            last_checkpoint_time: None,
            updated_at: chrono_now_millis(),
        });
    ctx.current_task = current_task;
    ctx.progress = progress;
    ctx.active_work = active_work;
    ctx.updated_at = chrono_now_millis();
    state.storage.save_project_context(ctx.clone());
    Ok(ctx)
}

#[tauri::command]
pub fn record_user_decision(
    state: State<'_, AppState>,
    workspace_id: String,
    title: String,
    description: Option<String>,
    author_agent: Option<String>,
) -> Result<crate::models::ProjectDecision, String> {
    let mut ctx = state
        .storage
        .get_project_context(&workspace_id)
        .unwrap_or_else(|| ProjectContext {
            id: format!("ctx-{}", &workspace_id),
            workspace_id: workspace_id.clone(),
            current_task: String::new(),
            goal: String::new(),
            progress: 0,
            active_work: String::new(),
            decisions: Vec::new(),
            issues: Vec::new(),
            notes: Vec::new(),
            architecture: String::new(),
            relevant_files: Vec::new(),
            last_checkpoint_time: None,
            updated_at: chrono_now_millis(),
        });
    let decision = crate::models::ProjectDecision {
        id: format!("dec-{}", chrono_now_millis() % 100000),
        title,
        description,
        timestamp: chrono::Utc::now().format("%H:%M").to_string(),
        author_agent,
    };
    ctx.decisions.push(decision.clone());
    ctx.updated_at = chrono_now_millis();
    state.storage.save_project_context(ctx);
    Ok(decision)
}

#[tauri::command]
pub fn resolve_project_issue(
    state: State<'_, AppState>,
    workspace_id: String,
    issue_id: String,
) -> Result<(), String> {
    if let Some(mut ctx) = state.storage.get_project_context(&workspace_id) {
        for issue in &mut ctx.issues {
            if issue.id == issue_id {
                issue.status = "resolved".to_string();
            }
        }
        ctx.updated_at = chrono_now_millis();
        state.storage.save_project_context(ctx);
    }
    Ok(())
}

#[tauri::command]
pub fn get_agent_usage_stats(
    state: State<'_, AppState>,
    agent_id: String,
    provider: String,
) -> crate::models::AgentUsageStats {
    let now = chrono_now_millis();

    if provider.to_lowercase() == "antigravity" || provider.to_lowercase() == "agy" {
        // Inspect ~/.gemini/antigravity-cli/ transcripts to calculate exact active token burn
        let mut active_tokens = 0;
        let mut turns = 0;

        if let Some(home) = std::env::var_os("HOME") {
            let brain_path = std::path::Path::new(&home).join(".gemini/antigravity-cli/brain");
            if let Ok(entries) = std::fs::read_dir(&brain_path) {
                for entry in entries.flatten() {
                    let transcript_file =
                        entry.path().join(".system_generated/logs/transcript.jsonl");
                    if transcript_file.exists() {
                        if let Ok(content) = std::fs::read_to_string(&transcript_file) {
                            turns = content.lines().count();
                            // Standard estimate: 4 chars per token from clean transcript turns
                            active_tokens = content.len() / 4;
                            break;
                        }
                    }
                }
            }
        }

        // Fallback to PTY stream history if transcript is not found
        if active_tokens == 0 {
            let pty_history = state.pty_manager.get_history(&agent_id);
            active_tokens = (pty_history.len() / 4).max(350);
            turns = pty_history.lines().count();
        }

        let max_context_tokens = 1_000_000; // 1M tokens context ceiling for Gemini 1.5/2.0
        let percentage_used =
            ((active_tokens as f32 / max_context_tokens as f32) * 100.0).min(100.0);
        let estimated_cost_usd = (active_tokens as f32 / 1_000_000.0) * 0.35; // Gemini Flash baseline pricing

        return crate::models::AgentUsageStats {
            provider: "antigravity".to_string(),
            active_tokens,
            max_context_tokens,
            percentage_used,
            transcript_turns: turns,
            estimated_cost_usd,
            last_updated: now,
        };
    }

    // Default fallback for other agents
    let pty_history = state.pty_manager.get_history(&agent_id);
    let active_tokens = (pty_history.len() / 4).max(120);
    let max_context_tokens = 200_000;
    let percentage_used = ((active_tokens as f32 / max_context_tokens as f32) * 100.0).min(100.0);

    crate::models::AgentUsageStats {
        provider,
        active_tokens,
        max_context_tokens,
        percentage_used,
        transcript_turns: pty_history.lines().count(),
        estimated_cost_usd: (active_tokens as f32 / 1_000_000.0) * 3.0,
        last_updated: now,
    }
}

#[tauri::command]
pub fn write_project_skill_file(
    project_path: String,
    relative_path: String,
    content: String,
) -> Result<bool, String> {
    let base = std::path::Path::new(&project_path);
    if !base.is_dir() {
        return Err("Target project path is not a valid directory".to_string());
    }

    // Security: skill projections are always relative to the workspace and
    // may not escape through `..`, absolute paths, or symlinked parents.
    let relative = std::path::Path::new(&relative_path);
    if relative.is_absolute() || relative.components().any(|component| {
        matches!(component, std::path::Component::ParentDir)
    }) {
        return Err("Path traversal attempt detected: skill write blocked".to_string());
    }
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;
    let full_path = canonical_base.join(relative);
    let parent = full_path
        .parent()
        .ok_or_else(|| "Invalid skill destination".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("Failed to resolve skill directory: {}", e))?;
    if !canonical_parent.starts_with(&canonical_base) {
        return Err("Skill destination escaped project directory".to_string());
    }
    let normalized = canonical_parent.join(
        full_path
            .file_name()
            .ok_or_else(|| "Invalid skill filename".to_string())?,
    );

    // Atomic replacement prevents partially written SKILL.md files if the
    // process is interrupted while a bundle is being mounted.
    let temp = normalized.with_extension("orbit.tmp");
    std::fs::write(&temp, content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;
    std::fs::rename(&temp, &normalized)
        .map_err(|e| format!("Failed to commit skill file: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub fn remove_project_skill_file(
    project_path: String,
    relative_path: String,
) -> Result<bool, String> {
    let base = std::path::Path::new(&project_path);
    let relative = std::path::Path::new(&relative_path);
    if relative.is_absolute() || relative.components().any(|component| {
        matches!(component, std::path::Component::ParentDir)
    }) {
        return Err("Path traversal attempt detected: skill removal blocked".to_string());
    }
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;
    let normalized = canonical_base.join(relative);
    if let Some(parent) = normalized.parent() {
        if parent.exists() {
            let canonical_parent = parent
                .canonicalize()
                .map_err(|e| format!("Failed to resolve skill directory: {}", e))?;
            if !canonical_parent.starts_with(&canonical_base) {
                return Err("Skill removal escaped project directory".to_string());
            }
        }
    }

    if normalized.is_file() {
        let _ = std::fs::remove_file(&normalized);
        // Clean up parent directory if empty
        if let Some(parent) = normalized.parent() {
            if parent.starts_with(base) && parent != base {
                let _ = std::fs::remove_dir(parent); // only removes if empty
            }
        }
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub fn refresh_detected_agents() -> Vec<DetectedAgent> {
    crate::discovery::invalidate_detection_cache();
    detect_all_agents()
}

#[tauri::command]
pub async fn install_agent_cli(provider: String, command: String) -> Result<String, String> {
    let prov = provider.to_lowercase().trim().to_string();
    let allowlist = [
        "antigravity",
        "claude",
        "codex",
        "opencode",
        "kilocode",
        "freebuff",
        "cline",
        "copilot",
        "goose",
        "kiro",
        "qwen",
        "mimo",
        "muse",
        "vibe",
        "qoder",
    ];
    if !allowlist.contains(&prov.as_str()) {
        return Err(format!(
            "Provider '{}' is not supported for 1-click install.",
            provider
        ));
    }

    #[cfg(target_os = "windows")]
    let mut cmd = std::process::Command::new("powershell");
    #[cfg(target_os = "windows")]
    cmd.args(["-NoProfile", "-Command", &command]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = std::process::Command::new("bash");
    #[cfg(not(target_os = "windows"))]
    {
        // Wrap with sourcing of user shell environments (nvm, cargo, local)
        let wrapped_cmd = format!(
            "source ~/.nvm/nvm.sh 2>/dev/null || true; source ~/.cargo/env 2>/dev/null || true; {}",
            command
        );
        cmd.args(["-l", "-c", &wrapped_cmd]);
    }

    cmd.env_remove("npm_config_prefix");
    cmd.env_remove("NPM_CONFIG_PREFIX");
    cmd.env_remove("NPM_CONFIG_GLOBALCONFIG");

    let host_path = crate::discovery::get_augmented_host_path();
    cmd.env("PATH", &host_path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute installer: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!(
            "Installer exited with error:\n{}{}",
            stdout, stderr
        ));
    }

    // Mark as orbit-managed and invalidate discovery cache
    crate::discovery::set_provider_orbit_managed(&prov, true);
    crate::discovery::invalidate_detection_cache();
    let detected = detect_all_agents();
    let is_now_available = detected
        .iter()
        .any(|d| d.provider.to_lowercase() == prov && d.is_available);

    let summary = if stdout.is_empty() { stderr } else { stdout };
    if is_now_available {
        Ok(format!(
            "✅ Successfully installed and verified {}\n{}",
            prov, summary
        ))
    } else {
        Ok(format!("Installer completed for {}.\n{}", prov, summary))
    }
}

#[tauri::command]
pub async fn uninstall_agent_cli(
    state: State<'_, AppState>,
    provider: String,
) -> Result<String, String> {
    let prov = provider.to_lowercase().trim().to_string();
    if prov == "terminal" || prov == "shell" {
        return Err("The system shell terminal cannot be uninstalled.".to_string());
    }

    let uninstall_map: [(&str, &str); 15] = [
        ("antigravity", "rm -f ~/.local/bin/agy ~/.gemini/antigravity-cli/bin/agy ~/.local/share/orbit/engines/antigravity/bin/agy 2>/dev/null || true"),
        ("claude", "npm uninstall -g @anthropic-ai/claude-code 2>/dev/null; rm -f ~/.local/bin/claude 2>/dev/null || true"),
        ("codex", "npm uninstall -g @openai/codex 2>/dev/null; rm -f ~/.npm-global/bin/codex 2>/dev/null || true"),
        ("opencode", "npm uninstall -g opencode-ai 2>/dev/null; rm -f ~/.nvm/versions/node/*/bin/opencode ~/.npm-global/bin/opencode 2>/dev/null || true"),
        ("kilocode", "npm uninstall -g @kilocode/cli 2>/dev/null; rm -f ~/.nvm/versions/node/*/bin/kilocode ~/.npm-global/bin/kilocode 2>/dev/null || true"),
        ("freebuff", "npm uninstall -g freebuff 2>/dev/null; rm -f ~/.nvm/versions/node/*/bin/freebuff ~/.npm-global/bin/freebuff 2>/dev/null || true"),
        ("cline", "npm uninstall -g cline 2>/dev/null; rm -f ~/.nvm/versions/node/*/bin/cline ~/.npm-global/bin/cline 2>/dev/null || true"),
        ("copilot", "npm uninstall -g @github/copilot 2>/dev/null; rm -f ~/.npm-global/bin/copilot ~/.nvm/versions/node/*/bin/copilot 2>/dev/null || true"),
        ("goose", "rm -f ~/.local/bin/goose ~/.cargo/bin/goose 2>/dev/null || true"),
        ("kiro", "rm -f ~/.local/bin/kiro ~/.local/bin/kiro-cli 2>/dev/null; npm uninstall -g kiro-cli 2>/dev/null || true"),
        ("qwen", "npm uninstall -g @qwen-code/qwen-code 2>/dev/null; rm -f ~/.var/app/com.visualstudio.code/data/node_modules/bin/qwen 2>/dev/null || true"),
        ("mimo", "npm uninstall -g @mimo-ai/cli 2>/dev/null; rm -f ~/.local/bin/mimo ~/.npm-global/bin/mimo 2>/dev/null || true"),
        ("muse", "rm -f ~/.local/bin/muse ~/.local/bin/muse-cli 2>/dev/null || true"),
        ("vibe", "rm -f ~/.local/bin/vibe ~/.local/share/uv/tools/mistral-vibe/bin/vibe 2>/dev/null || true"),
        ("qoder", "rm -rf ~/.qoder 2>/dev/null; rm -f ~/.local/bin/qodercli 2>/dev/null || true"),
    ];

    let cmd_str = match uninstall_map.iter().find(|(p, _)| *p == prov.as_str()) {
        Some((_, c)) => *c,
        None => {
            return Err(format!(
                "Unknown provider '{}' for uninstallation.",
                provider
            ))
        }
    };

    // 1. Terminate any active sessions for this provider
    state
        .terminal_service
        .stop_provider(&prov)
        .map_err(|error| format!("Failed to stop native provider sessions: {error}"))?;
    state.pty_manager.terminate_by_provider(&prov);

    // 2. Run the verified safe uninstaller command
    #[cfg(target_os = "windows")]
    let mut cmd = std::process::Command::new("powershell");
    #[cfg(target_os = "windows")]
    cmd.args(["-NoProfile", "-Command", cmd_str]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = std::process::Command::new("bash");
    #[cfg(not(target_os = "windows"))]
    {
        let wrapped_cmd = format!(
            "source ~/.nvm/nvm.sh 2>/dev/null || true; source ~/.cargo/env 2>/dev/null || true; {}",
            cmd_str
        );
        cmd.args(["-l", "-c", &wrapped_cmd]);
    }

    let host_path = crate::discovery::get_augmented_host_path();
    cmd.env("PATH", &host_path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute uninstaller: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // 3. Update engine-state and invalidate cache
    crate::discovery::set_provider_orbit_managed(&prov, false);
    crate::discovery::invalidate_detection_cache();

    Ok(format!(
        "Agent {} uninstalled successfully.\n{}{}",
        prov, stdout, stderr
    ))
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WorkspaceFileContent {
    pub content: String,
    pub resolved_path: String,
    pub is_external: bool,
}

fn sanitize_clean_file_path(input_path: &str) -> String {
    let mut s = input_path.trim();
    if let Some(stripped) = s.strip_prefix("file://") {
        s = stripped;
    }
    // Trim leading formatting/quotes/brackets
    let s = s.trim_start_matches(|c| matches!(c, '*' | '_' | '`' | '\'' | '"' | '<' | '(' | '[' | '{' | '\\'));
    // Trim trailing formatting/quotes/brackets/punctuation
    let s = s.trim_end_matches(|c| matches!(c, '*' | '_' | '`' | '\'' | '"' | '>' | ')' | ']' | '}' | ';' | ',' | '.' | '!' | '?' | ':'));
    s.trim().to_string()
}

fn resolve_file_path(project_path: &str, relative_path: &str) -> std::path::PathBuf {
    let clean_str = sanitize_clean_file_path(relative_path);
    let clean = clean_str.as_str();

    // Expand tilde (~) if present
    if clean.starts_with('~') {
        let home = {
            #[cfg(windows)]
            {
                std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
            }
            #[cfg(not(windows))]
            {
                std::env::var_os("HOME").map(std::path::PathBuf::from)
            }
        };
        if let Some(h) = home {
            let sub = clean.trim_start_matches('~').trim_start_matches('/');
            return if sub.is_empty() { h } else { h.join(sub) };
        }
    }

    let p = std::path::Path::new(clean);
    if p.is_absolute() {
        p.to_path_buf()
    } else if !project_path.is_empty() {
        std::path::Path::new(project_path).join(clean)
    } else {
        p.to_path_buf()
    }
}

/// Looks up an agent-generated artifact (e.g. implementation_plan.md, walkthrough.md)
/// in known agent stores, prioritizing active sessions matching the current project_path.
fn find_agent_artifact_path(project_path: &str, input_path: &str) -> Option<std::path::PathBuf> {
    let clean_str = sanitize_clean_file_path(input_path);
    let clean = clean_str.as_str();

    let file_name = std::path::Path::new(clean)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(clean);

    if file_name.is_empty() {
        return None;
    }

    let home = {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(std::path::PathBuf::from)
        }
    }?;

    // 1. Check Antigravity / Gemini CLI brain directories
    let brain_path = home.join(".gemini/antigravity-cli/brain");
    if brain_path.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&brain_path) {
            let mut conv_folders: Vec<(std::path::PathBuf, std::time::SystemTime, bool)> = Vec::new();
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let mtime = entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

                    // Check if transcript in this brain directory matches current project_path
                    let mut matches_project = false;
                    if !project_path.is_empty() {
                        let transcript = path.join(".system_generated/logs/transcript.jsonl");
                        if transcript.exists() {
                            if let Ok(content) = std::fs::read_to_string(&transcript) {
                                if content.contains(project_path) {
                                    matches_project = true;
                                }
                            }
                        }
                    }
                    conv_folders.push((path, mtime, matches_project));
                }
            }

            // Prioritize sessions matching project_path, then newest modified time
            conv_folders.sort_by(|a, b| {
                match (a.2, b.2) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => b.1.cmp(&a.1),
                }
            });

            for (conv_dir, _, _) in conv_folders {
                // Direct file in conversation directory (e.g. brain/<id>/implementation_plan.md)
                let direct = conv_dir.join(file_name);
                if direct.is_file() {
                    return Some(direct);
                }
                // File in scratch directory
                let scratch = conv_dir.join("scratch").join(file_name);
                if scratch.is_file() {
                    return Some(scratch);
                }
                // Also check if relative path within conv_dir matches (e.g. if input was scratch/foo.py)
                let relative_in_conv = conv_dir.join(clean);
                if relative_in_conv.is_file() {
                    return Some(relative_in_conv);
                }
            }
        }
    }

    // 2. Check Claude / Orbit / common agent artifact stores
    let agent_dirs = [
        home.join(".claude/artifacts"),
        home.join(".claude/projects"),
        home.join(".orbit/artifacts"),
        home.join(".orbit/memory"),
        home.join(".orbit/handoff"),
        home.join(".local/share/orbit/artifacts"),
        home.join(".gemini/antigravity-cli/artifacts"),
        home.join(".aider"),
        home.join(".codex"),
        home.join(".cursor"),
    ];
    for dir in agent_dirs {
        if dir.is_dir() {
            let direct = dir.join(file_name);
            if direct.is_file() {
                return Some(direct);
            }
        }
    }

    None
}

/// Recursively searches for a file by name inside the project directory,
/// ignoring common build/dependency folders.
fn find_file_in_project_tree(project_path: &str, file_name: &str, max_depth: usize) -> Option<std::path::PathBuf> {
    if project_path.is_empty() || file_name.is_empty() {
        return None;
    }
    let root = std::path::Path::new(project_path);
    if !root.is_dir() {
        return None;
    }

    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if depth > max_depth {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = entry.file_type().ok();
            if file_type.map_or(false, |ft| ft.is_dir()) {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if matches!(name, "node_modules" | ".git" | "target" | "dist" | "build" | ".next" | ".cargo") {
                        continue;
                    }
                    stack.push((path, depth + 1));
                }
            } else if file_type.map_or(false, |ft| ft.is_file()) {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.eq_ignore_ascii_case(file_name) {
                        return Some(path);
                    }
                }
            }
        }
    }
    None
}

fn find_real_file_path(project_path: &str, input_path: &str) -> std::path::PathBuf {
    let clean_str = sanitize_clean_file_path(input_path);
    let clean = clean_str.as_str();

    // 1. Direct candidate
    let candidate = resolve_file_path(project_path, clean);
    if candidate.exists() {
        return candidate;
    }

    // 2. Try stripping trailing sentence punctuation like . , ; : ! ?
    let stripped_punct = clean.trim_end_matches(|c| matches!(c, '.' | ',' | ';' | ':' | '!' | '?'));
    if stripped_punct != clean {
        let candidate2 = resolve_file_path(project_path, stripped_punct);
        if candidate2.exists() {
            return candidate2;
        }
    }

    // 3. Try stripping trailing line/column indicators like :12:34 or :12
    if let Some(colon_pos) = clean.rfind(':') {
        let sub = &clean[..colon_pos];
        let sub2 = if let Some(first_colon) = sub.rfind(':') {
            if sub[first_colon + 1..].chars().all(|c| c.is_ascii_digit()) {
                &sub[..first_colon]
            } else {
                sub
            }
        } else {
            sub
        };
        let candidate3 = resolve_file_path(project_path, sub2);
        if candidate3.exists() {
            return candidate3;
        }
    }

    // 4. Check if file exists inside project tree (e.g. docs/, src/, .gemini/, .orbit/)
    let bare_name = std::path::Path::new(clean)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(clean);
    if let Some(in_tree) = find_file_in_project_tree(project_path, bare_name, 6) {
        return in_tree;
    }

    // 5. Look in agent artifact/brain directories (Antigravity CLI brain, Claude artifacts, Orbit)
    if let Some(agent_file) = find_agent_artifact_path(project_path, clean) {
        return agent_file;
    }

    // If still not found, return candidate so the error message shows the attempted path
    candidate
}

#[tauri::command]
pub fn read_workspace_file(project_path: String, relative_path: String) -> Result<WorkspaceFileContent, String> {
    let full_path = find_real_file_path(&project_path, &relative_path);

    if !full_path.exists() {
        return Err(format!("File not found: {}", full_path.display()));
    }
    if full_path.is_dir() {
        return Err(format!("Path is a directory: {}", full_path.display()));
    }

    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file {}: {}", full_path.display(), e))?;

    let resolved_path = full_path.to_string_lossy().to_string();
    let is_external = if !project_path.is_empty() {
        !resolved_path.starts_with(&project_path)
    } else {
        false
    };

    Ok(WorkspaceFileContent {
        content,
        resolved_path,
        is_external,
    })
}

#[tauri::command]
pub fn write_workspace_file(project_path: String, relative_path: String, content: String) -> Result<(), String> {
    let full_path = find_real_file_path(&project_path, &relative_path);

    let full_path_str = full_path.to_string_lossy();
    if full_path_str.starts_with("/etc")
        || full_path_str.starts_with("/bin")
        || full_path_str.starts_with("/usr")
        || full_path_str.starts_with("/sbin")
        || full_path_str.starts_with("/var/run")
        || full_path_str.starts_with("C:\\Windows")
        || full_path_str.starts_with("C:\\Program Files")
    {
        return Err(format!("Access denied: writing to system path {} is prohibited", full_path.display()));
    }

    if let Some(parent) = full_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write file {}: {}", full_path.display(), e))
}

#[tauri::command]
pub fn get_workspace_file_diff(project_path: String, file_path: String) -> Result<String, String> {
    Ok(crate::git::get_git_file_diff(&project_path, &file_path))
}

#[tauri::command]
pub fn get_recent_antigravity_transcript(workspace_path: Option<String>) -> Result<Option<String>, String> {
    let home = {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(std::path::PathBuf::from)
        }
    }.unwrap_or_else(|| std::path::PathBuf::from("."));

    let brain_dir = home.join(".gemini").join("antigravity-cli").join("brain");
    if !brain_dir.exists() {
        return Ok(None);
    }

    let entries = match std::fs::read_dir(&brain_dir) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };
    // (transcript_path, mtime, matches_workspace)
    let mut transcripts: Vec<(std::path::PathBuf, std::time::SystemTime, bool)> = Vec::new();
    let ws_needle = workspace_path.as_deref().map(|p| p.trim()).filter(|p| !p.is_empty());

    for entry in entries.flatten() {
        if entry.path().is_dir() {
            let transcript_path = entry.path().join(".system_generated").join("logs").join("transcript.jsonl");
            if transcript_path.exists() {
                if let Ok(meta) = transcript_path.metadata() {
                    if let Ok(mtime) = meta.modified() {
                        let mut matches_ws = false;
                        if let Some(needle) = ws_needle {
                            let terminals_dir = entry.path().join(".system_generated").join("terminals");
                            if let Ok(t_entries) = std::fs::read_dir(&terminals_dir) {
                                for t_entry in t_entries.flatten() {
                                    if let Ok(content) = std::fs::read_to_string(t_entry.path()) {
                                        if content.contains(needle) {
                                            matches_ws = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if !matches_ws {
                                use std::io::BufRead;
                                if let Ok(file) = std::fs::File::open(&transcript_path) {
                                    let reader = std::io::BufReader::new(file);
                                    for line in reader.lines().flatten().take(25) {
                                        if line.contains(needle) {
                                            matches_ws = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        transcripts.push((transcript_path, mtime, matches_ws));
                    }
                }
            }
        }
    }

    // Sort matching workspace sessions first, then by modified time descending
    transcripts.sort_by(|a, b| {
        b.2.cmp(&a.2).then_with(|| b.1.cmp(&a.1))
    });

    if let Some((latest_path, _, _)) = transcripts.first() {
        use std::io::{BufRead, BufReader};
        if let Ok(file) = std::fs::File::open(latest_path) {
            let reader = BufReader::new(file);
            let mut all_lines: Vec<String> = Vec::new();
            for line in reader.lines().flatten() {
                all_lines.push(line);
            }
            let selected_lines = if all_lines.len() <= 2500 {
                all_lines
            } else {
                let mut subset = Vec::with_capacity(2500);
                subset.extend_from_slice(&all_lines[..100]); // Always keep Turn 1 and initial user directive
                subset.extend_from_slice(&all_lines[all_lines.len() - 2400..]); // Keep recent trajectory
                subset
            };
            return Ok(Some(selected_lines.join("\n")));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn open_in_external_editor(project_path: String, relative_path: Option<String>) -> Result<(), String> {
    let target = match relative_path {
        Some(ref rel) if !rel.is_empty() => {
            find_real_file_path(&project_path, rel).to_string_lossy().to_string()
        }
        _ => project_path.clone(),
    };

    // Try VS Code first
    if let Ok(mut child) = std::process::Command::new("code").arg(&target).spawn() {
        let _ = child.wait();
        return Ok(());
    }

    // Fallback to system default opener
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &target]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&target).spawn();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
    }

    Ok(())
}

#[tauri::command]
pub fn git_stage_file(project_path: String, file_path: String) -> Result<(), String> {
    crate::git::stage_file(&project_path, &file_path)
}

#[tauri::command]
pub fn git_unstage_file(project_path: String, file_path: String) -> Result<(), String> {
    crate::git::unstage_file(&project_path, &file_path)
}

#[tauri::command]
pub fn git_stage_all(project_path: String) -> Result<(), String> {
    crate::git::stage_all(&project_path)
}

#[tauri::command]
pub fn git_unstage_all(project_path: String) -> Result<(), String> {
    crate::git::unstage_all(&project_path)
}

#[tauri::command]
pub fn git_discard_file(project_path: String, file_path: String) -> Result<(), String> {
    crate::git::discard_file(&project_path, &file_path)
}

#[tauri::command]
pub fn git_discard_all(project_path: String) -> Result<(), String> {
    crate::git::discard_all(&project_path)
}

#[tauri::command]
pub fn git_commit(project_path: String, message: String) -> Result<String, String> {
    crate::git::commit_changes(&project_path, &message)
}

#[tauri::command]
pub fn get_git_file_diff_data(
    project_path: String,
    file_path: String,
    staged: Option<bool>,
) -> Result<GitFileDiffData, String> {
    Ok(crate::git::get_git_file_diff_data(&project_path, &file_path, staged))
}

#[tauri::command]
pub fn git_clone_repo(clone_url: String, target_path: String) -> Result<String, String> {
    crate::git::clone_repository(&clone_url, &target_path)
}

#[tauri::command]
pub fn save_image_bytes(project_path: String, filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let dir = if !project_path.is_empty() {
        std::path::PathBuf::from(&project_path).join(".orbit").join("attachments")
    } else {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        home.join(".orbit").join("attachments")
    };
    let _ = std::fs::create_dir_all(&dir);
    let file_path = dir.join(&filename);
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to save image file: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_gh_cli_repos() -> Result<Vec<crate::git::GitHubCliRepo>, String> {
    crate::git::get_gh_cli_repositories()
}

#[tauri::command]
pub fn read_clipboard_text() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Clipboard"])
            .output()
        {
            if output.status.success() {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("pbpaste").output() {
            if output.status.success() {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 1. Try wl-paste
        if let Ok(output) = std::process::Command::new("wl-paste").args(["--no-newline"]).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).to_string();
                if !s.is_empty() { return Ok(s); }
            }
        }

        // 2. Try xclip
        if let Ok(output) = std::process::Command::new("xclip").args(["-selection", "clipboard", "-o"]).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).to_string();
                if !s.is_empty() { return Ok(s); }
            }
        }

        // 3. Try xsel
        if let Ok(output) = std::process::Command::new("xsel").args(["--clipboard", "--output"]).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).to_string();
                if !s.is_empty() { return Ok(s); }
            }
        }

        // 4. Try python3 with Gtk
        let py_script = "import gi\ngi.require_version('Gtk', '3.0')\nfrom gi.repository import Gtk, Gdk\ncb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)\nt = cb.wait_for_text()\nif t: print(t, end='')";
        if let Ok(output) = std::process::Command::new("python3").args(["-c", py_script]).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).to_string();
                return Ok(s);
            }
        }
    }

    Ok(String::new())
}

#[tauri::command]
pub fn write_clipboard_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let escaped = text.replace('\'', "''");
        let ps_cmd = format!("Set-Clipboard -Value '{}'", escaped);
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .output();
    }

    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        if let Ok(mut child) = std::process::Command::new("pbcopy").stdin(std::process::Stdio::piped()).spawn() {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        let mut written = false;

        // Try wl-copy
        if let Ok(mut child) = std::process::Command::new("wl-copy").stdin(std::process::Stdio::piped()).spawn() {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            if child.wait().map(|s| s.success()).unwrap_or(false) {
                written = true;
            }
        }

        // Try xclip
        if !written {
            if let Ok(mut child) = std::process::Command::new("xclip").args(["-selection", "clipboard"]).stdin(std::process::Stdio::piped()).spawn() {
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(text.as_bytes());
                }
                if child.wait().map(|s| s.success()).unwrap_or(false) {
                    written = true;
                }
            }
        }

        // Try python3 Gtk
        if !written {
            let py_script = format!(
                "import gi; gi.require_version('Gtk', '3.0'); from gi.repository import Gtk, Gdk; cb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD); cb.set_text({:?}, -1); cb.store()",
                text
            );
            let _ = std::process::Command::new("python3").args(["-c", &py_script]).output();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn read_clipboard_image(project_path: String) -> Result<Option<String>, String> {
    let dir = if !project_path.is_empty() {
        std::path::PathBuf::from(&project_path).join(".orbit").join("attachments")
    } else {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        home.join(".orbit").join("attachments")
    };
    let _ = std::fs::create_dir_all(&dir);
    let filename = format!("screenshot_{}.png", chrono_now_millis());
    let file_path = dir.join(&filename);
    let file_path_str = file_path.to_string_lossy().to_string();

    #[cfg(target_os = "linux")]
    {
        // 1. Try wl-paste --type image/png
        if let Ok(output) = std::process::Command::new("wl-paste").args(["--type", "image/png"]).output() {
            if output.status.success() && !output.stdout.is_empty() {
                if std::fs::write(&file_path, &output.stdout).is_ok() {
                    return Ok(Some(file_path_str));
                }
            }
        }

        // 2. Try xclip
        if let Ok(output) = std::process::Command::new("xclip").args(["-selection", "clipboard", "-t", "image/png", "-o"]).output() {
            if output.status.success() && !output.stdout.is_empty() {
                if std::fs::write(&file_path, &output.stdout).is_ok() {
                    return Ok(Some(file_path_str));
                }
            }
        }

        // 3. Try python3 with Gtk
        let py_script = format!(
            "import gi\ngi.require_version('Gtk', '3.0')\nfrom gi.repository import Gtk, Gdk\nGtk.init_check()\ncb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)\nimg = cb.wait_for_image()\nif img:\n    img.savev({:?}, 'png', [], [])\n    print('ok', end='')\nelse:\n    for target_name in ['image/png', 'image/jpeg', 'PNG']:\n        atom = Gdk.Atom.intern(target_name, False)\n        if cb.wait_is_target_available(atom):\n            sel = cb.wait_for_contents(atom)\n            if sel and sel.get_data():\n                with open({:?}, 'wb') as f: f.write(sel.get_data())\n                print('ok', end='')\n                break",
            file_path_str, file_path_str
        );
        if let Ok(output) = std::process::Command::new("python3").args(["-c", &py_script]).output() {
            if String::from_utf8_lossy(&output.stdout).trim() == "ok" && file_path.exists() {
                return Ok(Some(file_path_str));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) {{ $img.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); Write-Host 'ok' }}",
            file_path_str.replace('\'', "''")
        );
        if let Ok(output) = std::process::Command::new("powershell").args(["-NoProfile", "-Command", &ps_script]).output() {
            if String::from_utf8_lossy(&output.stdout).trim() == "ok" && file_path.exists() {
                return Ok(Some(file_path_str));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn get_latest_screenshot(project_path: Option<String>) -> Result<Option<String>, String> {
    let mut dirs: Vec<std::path::PathBuf> = Vec::new();

    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from);

    if let Some(ref h) = home {
        dirs.push(h.join("Pictures").join("Screenshots"));
        dirs.push(h.join("Pictures"));
        dirs.push(h.join("Desktop"));
        dirs.push(h.join(".orbit").join("attachments"));
    }

    if let Some(ref p) = project_path {
        if !p.is_empty() {
            dirs.push(std::path::PathBuf::from(p).join(".orbit").join("attachments"));
        }
    }

    let mut latest_path: Option<std::path::PathBuf> = None;
    let mut latest_time = std::time::SystemTime::UNIX_EPOCH;

    for dir in dirs {
        if !dir.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if ["png", "jpg", "jpeg", "webp"].contains(&ext.as_str()) {
                        if let Ok(meta) = entry.metadata() {
                            if let Ok(modified) = meta.modified() {
                                if modified > latest_time {
                                    latest_time = modified;
                                    latest_path = Some(path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(latest_path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn read_image_base64(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err(format!("File does not exist: {}", path));
    }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };

    let bytes = std::fs::read(p).map_err(|e| format!("Failed to read image: {}", e))?;
    const STANDARD: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut b64 = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        b64.push(STANDARD[(b0 >> 2) as usize] as char);
        b64.push(STANDARD[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            b64.push(STANDARD[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            b64.push('=');
        }
        if chunk.len() > 2 {
            b64.push(STANDARD[(b2 & 0x3f) as usize] as char);
        } else {
            b64.push('=');
        }
    }

    Ok(format!("data:{};base64,{}", mime, b64))
}

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn transcribe_audio(audio_path: String) -> Result<String, String> {
    let p = std::path::Path::new(&audio_path);
    if !p.exists() {
        return Err(format!("Audio file not found: {}", audio_path));
    }

    // Locate whisper-cli binary
    let whisper_bin = {
        let mut found: Option<std::path::PathBuf> = None;
        if let Some(home) = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(std::path::PathBuf::from)
        {
            let candidates = [
                home.join(".local/bin/whisper-cli"),
                home.join(".cargo/bin/whisper-cli"),
                home.join("bin/whisper-cli"),
            ];
            for c in candidates {
                if c.is_file() {
                    found = Some(c);
                    break;
                }
            }
        }
        if found.is_none() {
            let common_paths = [
                std::path::PathBuf::from("/usr/local/bin/whisper-cli"),
                std::path::PathBuf::from("/usr/bin/whisper-cli"),
                std::path::PathBuf::from("/tmp/whisper.cpp/build/bin/whisper-cli"),
            ];
            for c in common_paths {
                if c.is_file() {
                    found = Some(c);
                    break;
                }
            }
        }
        if found.is_none() {
            if let Ok(output) = std::process::Command::new("which").arg("whisper-cli").output() {
                let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !s.is_empty() {
                    let pb = std::path::PathBuf::from(&s);
                    if pb.is_file() {
                        found = Some(pb);
                    }
                }
            }
        }
        found.ok_or_else(|| "whisper-cli binary not found on system. Please ensure whisper-cli is installed.".to_string())?
    };

    // Locate Whisper ggml model (prioritize base.en for high accuracy, fallback to tiny.en)
    let model_path = {
        let mut found: Option<std::path::PathBuf> = None;
        if let Some(home) = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(std::path::PathBuf::from)
        {
            let candidates = [
                home.join(".local/share/whisper/ggml-base.en.bin"),
                home.join(".local/share/whisper/ggml-small.en.bin"),
                home.join(".local/share/whisper/ggml-tiny.en.bin"),
                home.join(".local/share/whisper/ggml-base.bin"),
                home.join(".local/share/whisper/ggml-tiny.bin"),
                home.join(".cache/whisper/ggml-base.en.bin"),
                home.join(".cache/whisper/ggml-tiny.en.bin"),
            ];
            for c in candidates {
                if c.is_file() {
                    found = Some(c);
                    break;
                }
            }
        }
        if found.is_none() {
            let tmp_candidates = [
                std::path::PathBuf::from("/tmp/whisper.cpp/models/ggml-base.en.bin"),
                std::path::PathBuf::from("/tmp/whisper.cpp/models/ggml-small.en.bin"),
                std::path::PathBuf::from("/tmp/whisper.cpp/models/ggml-tiny.en.bin"),
            ];
            for c in tmp_candidates {
                if c.is_file() {
                    found = Some(c);
                    break;
                }
            }
        }
        found.ok_or_else(|| "Whisper speech model not found (expected ~/.local/share/whisper/ggml-base.en.bin or ggml-tiny.en.bin)".to_string())?
    };

    let output = std::process::Command::new(&whisper_bin)
        .args([
            "-m",
            model_path.to_str().unwrap_or(""),
            "-f",
            &audio_path,
            "-nt",
            "--no-prints",
            "-t",
            "4",
            "-l",
            "en",
            "--prompt",
            "Orbit software engineering AI assistant. Code, git, commit, push, branch, terminal, React, TypeScript, Rust, build, test, refactor, bug, agents, CLI, workspace.",
        ])
        .output()
        .map_err(|e| format!("Failed to execute whisper-cli: {}", e))?;

    let raw_text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Clean up any non-speech tokens or tags
    let lines = raw_text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('[') && !l.ends_with(']'))
        .collect::<Vec<_>>();

    let mut result = if !lines.is_empty() {
        lines.join(" ")
    } else {
        if raw_text.contains("[BLANK_AUDIO]") {
            String::new()
        } else {
            raw_text
        }
    };

    result = result.replace("[BLANK_AUDIO]", "").trim().to_string();

    Ok(result)
}

