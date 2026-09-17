mod auth;
mod commands;
mod context;
mod discovery;
mod git;
mod mcp;
mod models;
mod runtime;
mod storage;
mod terminal;

use commands::{
    apply_context_draft, create_session, create_workspace, delete_agent, delete_checkpoint,
    delete_workspace, detect_agents, execute_agent_handoff, generate_context_draft,
    generate_context_package, get_agent_mcp_tools, get_agent_terminal_history,
    get_agent_usage_stats, get_checkpoints, get_git_state, get_handoff_history,
    get_project_activity, get_project_context, get_sessions, get_workspace_agents, get_workspaces,
    get_profiles, save_profile, delete_profile,
    install_agent_cli, interrupt_agent_session, is_agent_process_running, open_external_url,
    open_file_dialog, open_folder_dialog, record_handoff, record_user_decision,
    refresh_detected_agents, remove_project_skill_file, resize_agent_terminal,
    resolve_project_issue, save_agent, save_checkpoint, save_project_context, send_agent_input,
    set_agent_role, start_agent_session, stop_agent_session, terminal_v2_attach,
    terminal_v2_detach, terminal_v2_diagnostics, terminal_v2_input, terminal_v2_interrupt,
    terminal_v2_resize, terminal_v2_snapshot, terminal_v2_start, terminal_v2_stop,
    uninstall_agent_cli, write_project_skill_file, read_workspace_file, write_workspace_file,
    get_workspace_file_diff, open_in_external_editor, git_stage_file, git_unstage_file,
    git_stage_all, git_unstage_all, git_discard_file, git_discard_all, git_commit,
    get_git_file_diff_data, git_clone_repo, get_gh_cli_repos, save_image_bytes,
    read_clipboard_text, write_clipboard_text, read_clipboard_image,
    get_latest_screenshot, read_image_base64, transcribe_audio, AppState,
};
use runtime::{ActivityDetector, PtyManager};
use std::sync::Arc;
use storage::StorageManager;
use terminal::TerminalService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // Fix WebKitGTK black/blank screen freeze on Linux with hardware acceleration / DMA-BUF
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    if std::env::var_os("ORBIT_TERMINAL_HEADLESS_SMOKE").is_some() {
        if let Err(error) = terminal::smoke::run() {
            eprintln!("[ORBIT TERMINAL SMOKE] failed: {error}");
            std::process::exit(1);
        }
        if std::env::var_os("ORBIT_TERMINAL_PROVIDER_MATRIX").is_some() {
            if let Err(error) = terminal::smoke::run_provider_matrix() {
                eprintln!("[ORBIT PROVIDER MATRIX] failed: {error}");
                std::process::exit(1);
            }
        }
        eprintln!("[ORBIT TERMINAL SMOKE] passed");
        return;
    }

    // Log every panic to the Orbit debug file before it unwinds. Without this,
    // thread panics (e.g. a poisoned Mutex during PTY teardown) surface only as
    // opaque "task N panicked" JoinErrors with no root cause. Capturing the
    // backtrace here makes the actual first failure diagnosable.
    std::panic::set_hook(Box::new(|info| {
        let log_path = std::env::temp_dir().join("orbit-debug.log");
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
        {
            use std::io::Write;
            let payload = info
                .payload()
                .downcast_ref::<&str>()
                .map(|s| s.to_string())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "unknown panic payload".to_string());
            let _ = writeln!(f, "\n===== ORBIT PANIC: {} =====", payload);
            let location = info
                .location()
                .map(|l| format!(" at {}:{}", l.file(), l.line()))
                .unwrap_or_default();
            let _ = writeln!(f, "location: {}", location);
            let full_bt = std::backtrace::Backtrace::capture().to_string();
            let bt: Vec<&str> = full_bt.lines().take(6).collect();
            if !bt.is_empty() {
                let _ = writeln!(f, "backtrace:\n{}", bt.join("\n"));
            }
            let _ = writeln!(f, "===== END ORBIT PANIC =====\n");
        }
    }));

    let activity_detector = Arc::new(ActivityDetector::new());
    let pty_manager = Arc::new(PtyManager::new(activity_detector.clone()));
    let storage = Arc::new(StorageManager::new());
    let terminal_service = Arc::new(TerminalService::new());

    let state = AppState {
        pty_manager,
        storage,
        terminal_service,
    };

    // Pre-warm agent detection in background thread so opening modal is instantaneous
    std::thread::spawn(|| {
        let _ = discovery::detect_all_agents();
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.with_webview(|webview| {
                        use webkit2gtk::{PermissionRequestExt, WebViewExt};
                        webview.inner().connect_permission_request(|_view, request| {
                            request.allow();
                            true
                        });
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_agents,
            refresh_detected_agents,
            get_workspaces,
            create_workspace,
            delete_workspace,
            open_folder_dialog,
            open_file_dialog,
            get_workspace_agents,
            save_agent,
            delete_agent,
            get_profiles,
            save_profile,
            delete_profile,
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
            remove_project_skill_file,
            read_workspace_file,
            write_workspace_file,
            get_workspace_file_diff,
            open_in_external_editor,
            git_stage_file,
            git_unstage_file,
            git_stage_all,
            git_unstage_all,
            git_discard_file,
            git_discard_all,
            git_commit,
            get_git_file_diff_data,
            git_clone_repo,
            get_gh_cli_repos,
            save_image_bytes,
            read_clipboard_text,
            write_clipboard_text,
            read_clipboard_image,
            get_latest_screenshot,
            read_image_base64,
            transcribe_audio,
            install_agent_cli,
            uninstall_agent_cli,
            open_external_url,
            terminal_v2_start,
            terminal_v2_attach,
            terminal_v2_detach,
            terminal_v2_input,
            terminal_v2_resize,
            terminal_v2_snapshot,
            terminal_v2_interrupt,
            terminal_v2_stop,
            terminal_v2_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running orbit application");
}
