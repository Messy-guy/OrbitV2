use tauri::{AppHandle, State};
use std::sync::Arc;
use crate::context::build_context_package;
use crate::discovery::detect_all_agents;
use crate::git::inspect_git_state;
use crate::models::{
    Agent, ChangedFileItem, Checkpoint, ContextPackage, DetectedAgent, GitState,
    HandoffRecord, ProjectContext, Session, Workspace,
};
use crate::runtime::PtyManager;
use crate::storage::StorageManager;

pub struct AppState {
    pub pty_manager: Arc<PtyManager>,
    pub storage: Arc<StorageManager>,
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
pub fn create_workspace(state: State<'_, AppState>, name: String, project_path: String) -> Workspace {
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
            .args(["--file-selection", "--directory", "--title=Select Project Folder for Orbit Workspace"])
            .output()
        {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && std::path::Path::new(&path_str).is_dir() {
                return Some(path_str);
            }
        }

        if let Ok(output) = std::process::Command::new("kdialog")
            .args(["--getexistingdirectory", "--title", "Select Project Folder for Orbit Workspace"])
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
pub fn delete_agent(state: State<'_, AppState>, agent_id: String) -> Result<(), String> {
    state.pty_manager.terminate(&agent_id);
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
#[tauri::command]
pub fn start_agent_session(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace_id: Option<String>,
    workspace_path: String,
    agent_id: String,
    session_id: String,
    provider: String,
    prompt: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<u32, String> {
    state.pty_manager.create_session(
        app,
        workspace_id.unwrap_or_else(|| "default-ws".to_string()),
        workspace_path,
        agent_id,
        session_id,
        provider,
        prompt,
        rows.unwrap_or(30),
        cols.unwrap_or(100),
    )
}

#[tauri::command]
pub fn send_agent_input(
    state: State<'_, AppState>,
    agent_id: String,
    _session_id: String,
    input: String,
) -> Result<(), String> {
    // Send raw PTY byte stream directly as typed (e.g. letters, backspaces, enter keys)
    state.pty_manager.write(&agent_id, &input)
}

#[tauri::command]
pub fn resize_agent_terminal(
    state: State<'_, AppState>,
    agent_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.pty_manager.resize(&agent_id, rows, cols)
}

#[tauri::command]
pub fn interrupt_agent_session(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    state.pty_manager.interrupt(&agent_id)
}

#[tauri::command]
pub fn get_agent_terminal_history(
    state: State<'_, AppState>,
    agent_id: String,
) -> String {
    state.pty_manager.get_history(&agent_id)
}

#[tauri::command]
pub fn is_agent_process_running(
    state: State<'_, AppState>,
    agent_id: String,
) -> bool {
    state.pty_manager.is_running(&agent_id)
}

#[tauri::command]
pub fn stop_agent_session(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    state.pty_manager.terminate(&agent_id);
    Ok(())
}

// Phase 3: Git State
#[tauri::command]
pub fn get_git_state(project_path: String) -> GitState {
    inspect_git_state(&project_path)
}

// Phase 3: Project Context
#[tauri::command]
pub fn get_project_context(state: State<'_, AppState>, workspace_id: String) -> Option<ProjectContext> {
    state.storage.get_project_context(&workspace_id)
}

#[tauri::command]
pub fn save_project_context(state: State<'_, AppState>, context: ProjectContext) -> Result<(), String> {
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
        let _ = std::fs::write(&handoff_file, handoff.context_package.formatted_instruction.as_deref().unwrap_or(""));

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
        let mut session_content = std::fs::read_to_string(&session_file).unwrap_or_else(|_| "# Orbit Continuous Project Memory\n".to_string());
        session_content.push_str(&session_log_entry);
        let _ = std::fs::write(&session_file, session_content);

        // 2c. Cumulative DECISIONS.md
        if !handoff.context_package.decisions.is_empty() {
            let decisions_file = memory_dir.join("DECISIONS.md");
            let mut decisions_content = std::fs::read_to_string(&decisions_file).unwrap_or_else(|_| "# Architectural Decisions Record\n".to_string());
            for dec in &handoff.context_package.decisions {
                decisions_content.push_str(&format!("\n- [{}]: {}", handoff.source_agent_name, dec));
            }
            let _ = std::fs::write(&decisions_file, decisions_content);
        }

        // 2d. Cumulative BUGS.md
        if !handoff.context_package.known_issues.is_empty() {
            let bugs_file = memory_dir.join("BUGS.md");
            let mut bugs_content = std::fs::read_to_string(&bugs_file).unwrap_or_else(|_| "# Tracked Project Blockers & Issues\n".to_string());
            for bug in &handoff.context_package.known_issues {
                bugs_content.push_str(&format!("\n- ⚠️ [{}] {}", handoff.source_agent_name, bug));
            }
            let _ = std::fs::write(&bugs_file, bugs_content);
        }
    }

    // 3. Build a concise single-line prompt pointing to the HANDOFF.md file.
    //    This is deliberately short so it fits in any CLI readline buffer safely
    //    and works generically for any TUI agent (OpenCode, agy, claude, codex, etc.).
    let concise_prompt = format!(
        "Orbit Handoff from {}: Continue working on '{}'. Full context in .orbit/HANDOFF.md",
        handoff.context_package.source_agent,
        handoff.context_package.current_task
    );

    // 4. If the target agent session is ALREADY running — write directly to its stdin.
    //    Never kill a live session during a handoff.
    if state.pty_manager.is_running(&handoff.target_agent_id) {
        // Append \r so TUI agents (Ink, readline) submit the input immediately
        let _ = state.pty_manager.write(&handoff.target_agent_id, &format!("{}\r", concise_prompt));
        return Ok(0);
    }

    // 5. Target is NOT running — spawn a fresh interactive session WITHOUT a prompt.
    //    Passing prompt=None means create_session will NOT kill any existing session
    //    and the TUI mounts cleanly. We then deliver the prompt via a delayed write,
    //    giving the TUI time to fully initialize before receiving any input.
    let target_session_id = handoff.target_session_id.unwrap_or_else(|| {
        format!("sess-{}-{}", handoff.target_agent_id, chrono_now_millis() % 10000)
    });

    // Spawn without prompt so the TUI initializes cleanly
    let pid = state.pty_manager.create_session(
        app,
        handoff.workspace_id.clone(),
        handoff.context_package.project_path.clone(),
        handoff.target_agent_id.clone(),
        target_session_id,
        target_provider.clone(),
        None, // No prompt — we deliver separately after TUI mounts
        30,
        100,
    )?;

    // 6. Deliver the handoff prompt after a startup delay.
    //    Use a longer delay for TUI-heavy CLIs (opencode uses Ink which needs ~2s to mount).
    let pty_manager = state.pty_manager.clone();
    let agent_id_clone = handoff.target_agent_id.clone();
    let prov_lower = target_provider.to_lowercase();
    std::thread::spawn(move || {
        // Delay: 2500ms for opencode (Ink TUI), 1000ms for all others
        let delay_ms = if prov_lower.contains("opencode") { 2500 } else { 1000 };
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        let _ = pty_manager.write(&agent_id_clone, &format!("{}\r", concise_prompt));
    });

    Ok(pid)
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
    state.pty_manager.activity_detector.generate_draft(&workspace_id, &project_path)
}

#[tauri::command]
pub fn apply_context_draft(
    state: State<'_, AppState>,
    workspace_id: String,
    current_task: String,
    progress: u32,
    active_work: String,
) -> Result<ProjectContext, String> {
    let mut ctx = state.storage.get_project_context(&workspace_id).unwrap_or_else(|| ProjectContext {
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
    let mut ctx = state.storage.get_project_context(&workspace_id).unwrap_or_else(|| ProjectContext {
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
                    let transcript_file = entry.path().join(".system_generated/logs/transcript.jsonl");
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
        let percentage_used = ((active_tokens as f32 / max_context_tokens as f32) * 100.0).min(100.0);
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

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
