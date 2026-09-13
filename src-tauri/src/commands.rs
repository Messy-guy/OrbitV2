use crate::context::build_context_package;
use crate::discovery::detect_all_agents;
use crate::git::inspect_git_state;
use crate::models::{
    Agent, ChangedFileItem, Checkpoint, ContextPackage, DetectedAgent, GitState, HandoffRecord,
    ProjectContext, Session, Workspace,
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

    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = '{}'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Host $f.FileName }}",
            dialog_title
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
            .args(["--file-selection", &format!("--title={}", dialog_title)])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_file() {
                return Some(path_str);
            }
        }

        if let Ok(output) = std::process::Command::new("kdialog")
            .args(["--getopenfilename", &format!("--title={}", dialog_title)])
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
) -> Result<u32, String> {
    // Keep role state available to the existing MCP/operational-mode paths;
    // the native launcher also applies provider-specific role flags.
    if let Some(r) = role.as_deref() {
        state.pty_manager.set_role(&agent_id, r);
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
    state.storage.save_checkpoint(checkpoint);
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

#[tauri::command]
pub fn execute_agent_handoff(
    app: AppHandle,
    state: State<'_, AppState>,
    handoff: HandoffRecord,
    target_provider: String,
) -> Result<u32, String> {
    // 1. Record the handoff
    state.storage.record_handoff(handoff.clone());

    // 2. Persist full handoff manifest & continuous memory in project directory (.orbit/memory/)
    let proj_path = &handoff.context_package.project_path;
    if !proj_path.is_empty() {
        let orbit_dir = std::path::Path::new(proj_path).join(".orbit");
        let memory_dir = orbit_dir.join("memory");
        let _ = std::fs::create_dir_all(&memory_dir);

        // 2a. Active Handoff briefing file
        let handoff_file = orbit_dir.join("HANDOFF.md");
        let _ = std::fs::write(
            &handoff_file,
            handoff
                .context_package
                .formatted_instruction
                .as_deref()
                .unwrap_or(""),
        );

        // 2b. Cumulative SESSION.md memory
        let session_log_entry = format!(
            "\n\n### Session Handoff: {} → {} ({})\n- **Task**: {}\n- **Progress**: {}\n- **Files Touched**: {}\n- **Decisions**: {}\n- **Blockers**: {}\n",
            handoff.source_agent_name,
            handoff.target_agent_name,
            chrono_now_millis(),
            handoff.context_package.current_task,
            handoff.context_package.progress,
            handoff.context_package.changed_files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>().join(", "),
            handoff.context_package.decisions.join("; "),
            handoff.context_package.known_issues.join("; ")
        );
        let session_file = memory_dir.join("SESSION.md");
        let mut session_content = std::fs::read_to_string(&session_file)
            .unwrap_or_else(|_| "# Orbit Continuous Project Memory\n".to_string());
        session_content.push_str(&session_log_entry);
        let _ = std::fs::write(&session_file, session_content);

        // 2c. Cumulative DECISIONS.md
        if !handoff.context_package.decisions.is_empty() {
            let decisions_file = memory_dir.join("DECISIONS.md");
            let mut decisions_content = std::fs::read_to_string(&decisions_file)
                .unwrap_or_else(|_| "# Architectural Decisions Record\n".to_string());
            for dec in &handoff.context_package.decisions {
                decisions_content
                    .push_str(&format!("\n- [{}]: {}", handoff.source_agent_name, dec));
            }
            let _ = std::fs::write(&decisions_file, decisions_content);
        }

        // 2d. Cumulative BUGS.md
        if !handoff.context_package.known_issues.is_empty() {
            let bugs_file = memory_dir.join("BUGS.md");
            let mut bugs_content = std::fs::read_to_string(&bugs_file)
                .unwrap_or_else(|_| "# Tracked Project Blockers & Issues\n".to_string());
            for bug in &handoff.context_package.known_issues {
                bugs_content.push_str(&format!("\n- ⚠️ [{}] {}", handoff.source_agent_name, bug));
            }
            let _ = std::fs::write(&bugs_file, bugs_content);
        }
    }

    // 3. Build a high-signal directive pointing directly to .orbit/HANDOFF.md.
    //    Explicitly command reading the brief first and adhering to the protocol.
    let concise_prompt = format!(
        "Please read .orbit/HANDOFF.md first and follow the ingestion protocol inside. (Handoff from {})",
        handoff.context_package.source_agent
    );

    // 4. If the target agent session is ALREADY running — write directly to its stdin.
    //    Never kill a live session during a handoff.
    if let Some(session) = state
        .terminal_service
        .session_for_agent(&handoff.target_agent_id)
        .filter(|session| session.is_running())
    {
        let _ = session.input(format!("{}\r", concise_prompt).into_bytes());
        return Ok(session.info.pid);
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

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
