use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter};

macro_rules! dbg_log {
    ($($arg:tt)*) => {{
        let log_path = std::env::temp_dir().join("orbit-debug.log");
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path) {
            let _ = writeln!(f, "[ORBIT] {}", format!($($arg)*));
        }
    }};
}

use crate::discovery::find_executable;
use crate::models::{AgentOutputEvent, AgentStatusEvent};
use crate::runtime::activity_detector::ActivityDetector;
use crate::runtime::session::PtySession;
use crate::runtime::session_events::{SessionEvent, SessionEventType};

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>, // agent_id -> PtySession
    pub activity_detector: Arc<ActivityDetector>,
}

impl PtyManager {
    pub fn new(activity_detector: Arc<ActivityDetector>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            activity_detector,
        }
    }

    pub fn get_history(&self, agent_id: &str) -> String {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(agent_id) {
            let hist = session.output_history.lock().unwrap();
            hist.clone()
        } else {
            String::new()
        }
    }

    pub fn is_running(&self, agent_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        map.contains_key(agent_id)
    }

    pub fn create_session(
        &self,
        app: AppHandle,
        workspace_id: String,
        workspace_path: String,
        agent_id: String,
        session_id: String,
        provider: String,
        profile_id: Option<String>,
        prompt: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<u32, String> {
        dbg_log!("[ORBIT DEBUG] create_session called: agent_id={} provider={} profile={:?}", agent_id, provider, profile_id);

        // If already running for this agent and no prompt, re-emit status so frontend can reattach
        {
            let map = self.sessions.lock().unwrap();
            if let Some(existing) = map.get(&agent_id) {
                if prompt.is_none() {
                    let pid = existing.pid;
                    dbg_log!("[ORBIT DEBUG] Reattaching to existing session PID={}", pid);
                    let _ = app.emit(
                        "agent-status",
                        AgentStatusEvent {
                            agent_id: agent_id.clone(),
                            session_id: Some(session_id.clone()),
                            status: "working".to_string(),
                            pid: Some(pid),
                            exit_code: None,
                            message: Some(format!("Reattached to existing PTY session PID {}", pid)),
                        },
                    );
                    return Ok(pid);
                }
            }
        }

        dbg_log!("[ORBIT DEBUG] Terminating old session...");
        // Terminate any existing session before starting fresh
        self.terminate(&agent_id);

        let cwd = if Path::new(&workspace_path).is_dir() {
            workspace_path.clone()
        } else {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "/tmp".to_string())
        };

        dbg_log!("[ORBIT DEBUG] CWD={}", cwd);

        // Open native pseudo-terminal pair with dimension configuration
        let pty_system = native_pty_system();
        let rows_val = if rows > 0 { rows } else { 30 };
        let cols_val = if cols > 0 { cols } else { 100 };

        dbg_log!("[ORBIT DEBUG] Opening PTY {}x{}...", cols_val, rows_val);
        let pair = pty_system
            .openpty(PtySize {
                rows: rows_val,
                cols: cols_val,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY pair: {}", e))?;

        dbg_log!("[ORBIT DEBUG] PTY opened. Resolving executable for provider={}", provider);

        // Resolve executable command and arguments
        let prov = provider.to_lowercase();
        let prompt_to_send = prompt.clone();
        let mut cmd_builder = match prov.as_str() {
            "antigravity" => {
                let bin = find_executable(
                    &["agy", "antigravity"],
                    &[
                        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin/agy",
                        "/home/leo/.local/bin/agy",
                    ],
                ).ok_or_else(|| "Antigravity CLI (agy) binary not found on host".to_string())?;

                let cmd = CommandBuilder::new(bin);
                cmd
            }
            "claude" => {
                let bin = find_executable(&["claude"], &["/home/leo/.local/bin/claude"])
                    .ok_or_else(|| "Claude Code CLI (claude) binary not found on host".to_string())?;

                let cmd = CommandBuilder::new(bin);
                cmd
            }
            "codex" => {
                let bin = find_executable(&["codex", "openai-codex"], &[])
                    .unwrap_or_else(|| {
                        #[cfg(target_os = "windows")]
                        {
                            find_executable(&["powershell", "cmd"], &[])
                                .unwrap_or_else(|| Path::new("powershell.exe").to_path_buf())
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"])
                                .unwrap_or_else(|| Path::new("bash").to_path_buf())
                        }
                    });
                let mut cmd = CommandBuilder::new(&bin);
                if bin.to_string_lossy().contains("bash") || bin.to_string_lossy().contains("sh") {
                    cmd.arg("-i");
                }
                cmd
            }
            "opencode" => {
                let opencode_extra = [
                    "/home/leo/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64/bin/opencode",
                    "/home/leo/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin/opencode",
                    "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64/bin/opencode",
                    "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin/opencode",
                    "/home/leo/.nvm/versions/node/v24.18.1/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode",
                    "/home/leo/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode",
                ];
                let bin = find_executable(&["opencode"], &opencode_extra)
                    .unwrap_or_else(|| {
                        #[cfg(target_os = "windows")]
                        {
                            find_executable(&["powershell", "cmd"], &[])
                                .unwrap_or_else(|| Path::new("powershell.exe").to_path_buf())
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"])
                                .unwrap_or_else(|| Path::new("bash").to_path_buf())
                        }
                    });
                let cmd = CommandBuilder::new(bin);
                cmd
            }
            "terminal" | "shell" | _ => {
                #[cfg(target_os = "windows")]
                let (bin, is_bash) = (
                    find_executable(&["powershell", "cmd"], &[])
                        .unwrap_or_else(|| Path::new("powershell.exe").to_path_buf()),
                    false,
                );
                #[cfg(not(target_os = "windows"))]
                let (bin, is_bash) = (
                    find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"])
                        .unwrap_or_else(|| Path::new("bash").to_path_buf()),
                    true,
                );

                let mut cmd = CommandBuilder::new(bin);
                if is_bash {
                    cmd.arg("-i");
                }
                cmd
            }
        };

        // Inherit all host environment variables (PATH, USER, LANG, etc.)
        // But sanitize child agent session tokens so they don't inherit the parent agent's active session
        for (key, value) in std::env::vars() {
            // Strip active session tokens & connection addresses
            if key.starts_with("ANTIGRAVITY_") || key.starts_with("JETSKI_") || key == "AI_AGENT" {
                continue;
            }
            cmd_builder.env(key, value);
        }

        // Apply isolated profile environment sandbox if specified (e.g. "work-account", "personal")
        if let Some(ref prof) = profile_id {
            if prof != "default" && !prof.trim().is_empty() {
                let user_home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                let profile_root = std::path::Path::new(&user_home).join(".orbit").join("profiles").join(prof.trim());
                let _ = std::fs::create_dir_all(&profile_root);
                let gemini_dir = profile_root.join(".gemini");
                let config_dir = profile_root.join(".config");
                let data_dir = profile_root.join(".local").join("share");
                let _ = std::fs::create_dir_all(&gemini_dir);
                let _ = std::fs::create_dir_all(&config_dir);
                let _ = std::fs::create_dir_all(&data_dir);

                let prof_str = profile_root.to_string_lossy().to_string();
                cmd_builder.env("HOME", &prof_str);
                cmd_builder.env("XDG_CONFIG_HOME", config_dir.to_string_lossy().to_string());
                cmd_builder.env("XDG_DATA_HOME", data_dir.to_string_lossy().to_string());
                cmd_builder.env("ANTIGRAVITY_CONFIG_DIR", gemini_dir.to_string_lossy().to_string());
                cmd_builder.env("JETSKI_APP_DATA_DIR", gemini_dir.join("antigravity-cli").to_string_lossy().to_string());
                cmd_builder.env("ORBIT_PROFILE_ID", prof.trim());

                // Disable DBUS / GNOME Keyring fallback so child process cannot read the system host keyring
                cmd_builder.env("DBUS_SESSION_BUS_ADDRESS", "disabled:");
                cmd_builder.env("GNOME_KEYRING_CONTROL", "");
                cmd_builder.env("PYTHON_KEYRING_BACKEND", "keyring.backends.null.Keyring");

                dbg_log!("[ORBIT PROFILE] Isolated sandbox mounted at: {}", prof_str);
            }
        }

        cmd_builder.cwd(&cwd);
        cmd_builder.env("TERM", "xterm-256color");
        cmd_builder.env("COLORTERM", "truecolor");
        cmd_builder.env("LINES", rows_val.to_string());
        cmd_builder.env("COLUMNS", cols_val.to_string());
        cmd_builder.env("ORBIT_WORKSPACE_ID", &workspace_id);
        cmd_builder.env("ORBIT_AGENT_ID", &agent_id);

        // Spawn child process in slave PTY
        dbg_log!("[ORBIT DEBUG] Spawning child process...");
        let child = pair
            .slave
            .spawn_command(cmd_builder)
            .map_err(|e| format!("Failed to spawn command in PTY: {}", e))?;

        let pid = child.process_id().unwrap_or(0);
        dbg_log!("[ORBIT DEBUG] Child spawned with PID={}", pid);

        // Take the writer
        let writer = pair.master.take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;
        dbg_log!("[ORBIT DEBUG] Writer taken");

        // Store the master PTY — reader is obtained inside the thread to avoid blocking the command thread
        let master_box = pair.master;

        let session = PtySession::new(
            session_id.clone(),
            workspace_id.clone(),
            workspace_path.clone(),
            agent_id.clone(),
            pid,
            writer,
            master_box,
            child,
            rows_val,
            cols_val,
        );

        let _child_arc = session.child.clone();
        let _history_arc = session.output_history.clone();
        let _master_arc = session.master.clone(); // for reader + resize
        let writer_for_initial_prompt = session.writer.clone();

        // Feed initial prompt into stdin after a short delay so the CLI process initializes its terminal/event loop
        if let Some(p) = prompt_to_send {
            if !p.trim().is_empty() {
                let p_clone = p.clone();
                let delay = if prov == "opencode" { 2200 } else { 800 };
                thread::spawn(move || {
                    thread::sleep(std::time::Duration::from_millis(delay));
                    if let Ok(mut w) = writer_for_initial_prompt.lock() {
                        let _ = w.write_all(p_clone.as_bytes());
                        let _ = w.write_all(b"\r");
                        let _ = w.flush();
                    }
                });
            }
        }

        // Record ProcessStarted Session Event
        let start_evt = SessionEvent::new(
            &session_id,
            &agent_id,
            &workspace_id,
            SessionEventType::ProcessStarted,
            serde_json::json!({
                "pid": pid,
                "provider": provider,
                "workspacePath": workspace_path,
            }),
        );
        self.activity_detector.process_event(&start_evt, &workspace_path);

        let child_arc = session.child.clone();
        let history_arc = session.output_history.clone();
        let master_arc = session.master.clone(); // for reader + resize

        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(agent_id.clone(), session);
        }
        dbg_log!("[ORBIT DEBUG] Session inserted into map");

        // Emit Status Event: Working — do this before spawning threads so IPC returns immediately
        dbg_log!("[ORBIT DEBUG] Emitting agent-status: working...");
        let _ = app.emit(
            "agent-status",
            AgentStatusEvent {
                agent_id: agent_id.clone(),
                session_id: Some(session_id.clone()),
                status: "working".to_string(),
                pid: Some(pid),
                exit_code: None,
                message: Some(format!("PTY session active on PID {}", pid)),
            },
        );
        dbg_log!("[ORBIT DEBUG] agent-status emitted");

        // Spawn PTY Reader Thread
        let app_reader = app.clone();
        let agent_id_reader = agent_id.clone();
        let session_id_reader = session_id.clone();
        let workspace_id_reader = workspace_id.clone();
        let workspace_path_reader = workspace_path.clone();
        let detector_reader = self.activity_detector.clone();
        dbg_log!("[ORBIT DEBUG] Spawning reader thread...");
        thread::spawn(move || {
            dbg_log!("[ORBIT DEBUG] Reader thread started, acquiring master lock...");
            let reader_result = {
                let master = master_arc.lock().unwrap();
                master.try_clone_reader()
            };

            let mut reader = match reader_result {
                Ok(r) => r,
                Err(e) => {
                    let _ = app_reader.emit(
                        "agent-output",
                        AgentOutputEvent {
                            agent_id: agent_id_reader.clone(),
                            session_id: session_id_reader.clone(),
                            stream: "system".to_string(),
                            text: format!("\r\n\x1b[31m[Orbit] PTY reader error: {}\x1b[0m\r\n", e),
                            timestamp: chrono_now_millis(),
                        },
                    );
                    return;
                }
            };

            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();

                        // Append to history buffer
                        if let Ok(mut hist) = history_arc.lock() {
                            if hist.len() > 100_000 {
                                hist.drain(..50_000);
                            }
                            hist.push_str(&chunk);
                        }

                        // Feed chunk into deterministic activity detector
                        let out_evt = SessionEvent::new(
                            &session_id_reader,
                            &agent_id_reader,
                            &workspace_id_reader,
                            SessionEventType::AgentOutput,
                            serde_json::json!({ "text": chunk }),
                        );
                        detector_reader.process_event(&out_evt, &workspace_path_reader);

                        // Emit raw terminal stream with ANSI data intact
                        let _ = app_reader.emit(
                            "agent-output",
                            AgentOutputEvent {
                                agent_id: agent_id_reader.clone(),
                                session_id: session_id_reader.clone(),
                                stream: "stdout".to_string(),
                                text: chunk,
                                timestamp: chrono_now_millis(),
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn Lifecycle Watcher Thread
        let app_watcher = app.clone();
        let agent_id_watcher = agent_id.clone();
        let session_id_watcher = session_id.clone();
        let workspace_id_watcher = workspace_id.clone();
        let workspace_path_watcher = workspace_path.clone();
        let detector_watcher = self.activity_detector.clone();
        let sessions_for_watcher = self.sessions.clone();
        thread::spawn(move || {
            loop {
                thread::sleep(std::time::Duration::from_millis(200));
                let mut guard = child_arc.lock().unwrap();
                match guard.try_wait() {
                    Ok(Some(status)) => {
                        let exit_code = if status.success() { 0 } else { 1 };

                        let exit_evt = SessionEvent::new(
                            &session_id_watcher,
                            &agent_id_watcher,
                            &workspace_id_watcher,
                            SessionEventType::ProcessExited,
                            serde_json::json!({ "exitCode": exit_code }),
                        );
                        detector_watcher.process_event(&exit_evt, &workspace_path_watcher);

                        let _ = app_watcher.emit(
                            "agent-status",
                            AgentStatusEvent {
                                agent_id: agent_id_watcher.clone(),
                                session_id: Some(session_id_watcher.clone()),
                                status: "exited".to_string(),
                                pid: Some(pid),
                                exit_code: Some(exit_code),
                                message: Some(format!("PTY session exited with code {}", exit_code)),
                            },
                        );
                        let _ = app_watcher.emit(
                            "agent-output",
                            AgentOutputEvent {
                                agent_id: agent_id_watcher.clone(),
                                session_id: session_id_watcher.clone(),
                                stream: "system".to_string(),
                                text: format!("\r\n\x1b[38;5;244m[Process exited with code {}]\x1b[0m\r\n", exit_code),
                                timestamp: chrono_now_millis(),
                            },
                        );
                        break;
                    }
                    Ok(None) => {}
                    Err(_) => break,
                }
            }

            let mut map = sessions_for_watcher.lock().unwrap();
            map.remove(&agent_id_watcher);
        });

        dbg_log!("[ORBIT DEBUG] Returning Ok(pid={}) from create_session", pid);
        Ok(pid)
    }

    pub fn write(&self, agent_id: &str, data: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(agent_id) {
            let mut writer = session.writer.lock().unwrap();
            writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            let _ = writer.flush();

            // Record UserInput event in activity detector
            let in_evt = SessionEvent::new(
                &session.session_id,
                &session.agent_id,
                &session.workspace_id,
                SessionEventType::UserInput,
                serde_json::json!({ "text": data }),
            );
            self.activity_detector.process_event(&in_evt, &session.workspace_path);

            Ok(())
        } else {
            Err("No active PTY session found for agent".to_string())
        }
    }

    pub fn resize(&self, agent_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(agent_id) {
            let master = session.master.lock().unwrap();
            master
                .resize(PtySize {
                    rows: if rows > 0 { rows } else { 30 },
                    cols: if cols > 0 { cols } else { 100 },
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err("No active PTY session found to resize".to_string())
        }
    }

    pub fn interrupt(&self, agent_id: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        if let Some(session) = map.get(agent_id) {
            let mut writer = session.writer.lock().unwrap();
            // Send ETX (Ctrl+C) to pseudo-terminal
            writer
                .write_all(b"\x03")
                .map_err(|e| format!("Failed to write SIGINT to PTY: {}", e))?;
            let _ = writer.flush();
            Ok(())
        } else {
            Err("No active PTY session found to interrupt".to_string())
        }
    }

    pub fn terminate(&self, agent_id: &str) {
        let mut map = self.sessions.lock().unwrap();
        if let Some(session) = map.remove(agent_id) {
            let mut child = session.child.lock().unwrap();
            let _ = child.kill();
        }
    }
}

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
