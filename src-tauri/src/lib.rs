mod models;
mod discovery;
mod storage;
mod git;
mod context;
mod runtime;
mod auth;
mod mcp;
mod commands;

use std::sync::Arc;
use commands::{
    create_session, create_workspace, delete_agent, delete_checkpoint, delete_workspace,
    detect_agents, execute_agent_handoff, generate_context_package, get_checkpoints,
    get_git_state, get_handoff_history, get_project_context, get_sessions,
    get_workspace_agents, get_workspaces, interrupt_agent_session, open_folder_dialog, open_file_dialog, record_handoff,
    resize_agent_terminal, save_agent, save_checkpoint, save_project_context,
    send_agent_input, set_agent_role, get_agent_mcp_tools, start_agent_session, stop_agent_session, get_agent_terminal_history,
    is_agent_process_running, get_project_activity, generate_context_draft, apply_context_draft,
    record_user_decision, resolve_project_issue, get_agent_usage_stats, write_project_skill_file, install_agent_cli, open_external_url, AppState,
};
use runtime::{ActivityDetector, PtyManager};
use storage::StorageManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let activity_detector = Arc::new(ActivityDetector::new());
    let pty_manager = Arc::new(PtyManager::new(activity_detector.clone()));
    let storage = Arc::new(StorageManager::new());

    let state = AppState {
        pty_manager,
        storage,
    };

    // Pre-warm agent detection in background thread so opening modal is instantaneous
    std::thread::spawn(|| {
        let _ = discovery::detect_all_agents();
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            detect_agents,
            get_workspaces,
            create_workspace,
            delete_workspace,
            open_folder_dialog,
            open_file_dialog,
            get_workspace_agents,
            save_agent,
            delete_agent,
            get_sessions,
            create_session,
            start_agent_session,
            send_agent_input,
            set_agent_role,
            get_agent_mcp_tools,
            resize_agent_terminal,
            interrupt_agent_session,
            stop_agent_session,
            get_agent_terminal_history,
            is_agent_process_running,
            get_git_state,
            get_project_context,
            save_project_context,
            get_checkpoints,
            save_checkpoint,
            delete_checkpoint,
            generate_context_package,
            get_handoff_history,
            record_handoff,
            execute_agent_handoff,
            get_project_activity,
            generate_context_draft,
            apply_context_draft,
            record_user_decision,
            resolve_project_issue,
            get_agent_usage_stats,
            write_project_skill_file,
            install_agent_cli,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running orbit application");
}
