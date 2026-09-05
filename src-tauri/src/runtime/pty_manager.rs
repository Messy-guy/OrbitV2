use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
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

use crate::discovery::{find_executable, get_augmented_host_path, is_unusable_sandbox_shim};
use crate::models::{AgentOutputEvent, AgentStatusEvent};
use crate::runtime::activity_detector::ActivityDetector;
use crate::runtime::session::PtySession;
use crate::runtime::session_events::{SessionEvent, SessionEventType};

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>, // agent_id -> PtySession
    roles: Arc<Mutex<HashMap<String, String>>>,        // agent_id -> role (e.g. "architect", "reviewer", "implementer")
    pub activity_detector: Arc<ActivityDetector>,
}

impl PtyManager {
    pub fn new(activity_detector: Arc<ActivityDetector>) -> Self {
        let sessions: Arc<Mutex<HashMap<String, PtySession>>> = Arc::new(Mutex::new(HashMap::new()));

        // Spawn a single long-lived background thread that refreshes Git state for
        // every active workspace on a slow cadence. Git inspection spawns up to four
        // `git` subprocesses; running it here (never on the PTY reader thread) keeps
        // agent CLI output flowing even on low-end machines with many concurrent agents.
        {
            let sessions_for_git = sessions.clone();
            let detector_for_git = activity_detector.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(5));
                let (workspace_ids, workspace_paths): (Vec<String>, Vec<String>) = {
                    let map = sessions_for_git.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                    let mut ids: Vec<String> = Vec::new();
                    let mut paths: Vec<String> = Vec::new();
                    for session in map.values() {
                        if !workspace_paths_contains(&paths, &session.workspace_path) {
                            paths.push(session.workspace_path.clone());
                            ids.push(session.workspace_id.clone());
                        }
                    }
                    (ids, paths)
                };
                for (id, path) in workspace_ids.into_iter().zip(workspace_paths) {
                    detector_for_git.refresh_git_state(&id, &path);
                }
            });
        }

        Self {
            sessions,
            roles: Arc::new(Mutex::new(HashMap::new())),
            activity_detector,
        }
    }

    pub fn set_role(&self, agent_id: &str, role: &str) {
        let mut map = self.roles.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        map.insert(agent_id.to_string(), role.to_string());

        // Update the isolated profile rule file dynamically for the specific agent session
        let user_home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let profiles_dir = std::path::Path::new(&user_home).join(".orbit").join("profiles");
        
        let role_rule_content = match role {
            "architect" => "# ROLE: SYSTEM ARCHITECT\n- You are in PLAN ONLY mode.\n- Do NOT create, write, edit, or modify any files.\n- Do NOT execute file modifying bash commands.\n- Only output specifications, architecture, and markdown plans.",
            "reviewer" => "# ROLE: CODE REVIEWER\n- You are in AUDIT ONLY mode.\n- Do NOT modify any files.\n- Focus exclusively on reviewing diffs, security flaws, and type safety.",
            _ => "",
        };

        // If active session exists, update only this agent's profile sandbox
        let sess_map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(session) = sess_map.get(agent_id) {
            let prof_path = profiles_dir.join(&session.agent_id);
            let gemini_config = prof_path.join(".gemini").join("config");
            let claude_config = prof_path.join(".claude");
            let _ = std::fs::create_dir_all(&gemini_config);
            let _ = std::fs::create_dir_all(&claude_config);

            let gemini_rule = gemini_config.join("GEMINI.md");
            let claude_rule = claude_config.join("CLAUDE.md");

            if !role_rule_content.is_empty() {
                let _ = std::fs::write(&gemini_rule, role_rule_content);
                let _ = std::fs::write(&claude_rule, role_rule_content);
            } else {
                let _ = std::fs::remove_file(&gemini_rule);
                let _ = std::fs::remove_file(&claude_rule);
            }
        }
    }

    fn find_session_key(map: &HashMap<String, PtySession>, id: &str) -> Option<String> {
        if map.contains_key(id) {
            return Some(id.to_string());
        }
        for (key, session) in map.iter() {
            if session.agent_id == id || session.session_id == id {
                return Some(key.clone());
            }
        }
        None
    }

    pub fn get_role(&self, agent_id: &str) -> String {
        let map = self.roles.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(r) = map.get(agent_id) {
            return r.clone();
        }
        // Check if agent_id is session_id
        let sess_map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(k) = Self::find_session_key(&sess_map, agent_id) {
            if let Some(r) = map.get(&k) {
                return r.clone();
            }
        }
        "raw".to_string()
    }

    pub fn get_history(&self, agent_id: &str) -> String {
        let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let target_key = Self::find_session_key(&map, agent_id);
        if let Some(key) = target_key {
            if let Some(session) = map.get(&key) {
                let hist = session.output_history.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                return hist.clone();
            }
        }
        String::new()
    }

    pub fn terminate_by_provider(&self, provider: &str) {
        let prov = provider.to_lowercase();
        let mut map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let keys_to_kill: Vec<String> = map.iter()
            .filter(|(k, s)| k.to_lowercase().contains(&prov) || s.agent_id.to_lowercase().contains(&prov))
            .map(|(k, _)| k.clone())
            .collect();
        for key in keys_to_kill {
            if let Some(mut session) = map.remove(&key) {
                if let Ok(mut child_guard) = session.child.try_lock() {
                    let _ = child_guard.kill();
                }
            }
        }
    }

    pub fn is_running(&self, agent_id: &str) -> bool {
        // Clone the child Arc while holding the map lock, then drop the lock
        // before calling try_lock on the child — avoids nested lock ordering issues.
        let child_arc = {
            let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
            let key = match Self::find_session_key(&map, agent_id) {
                Some(k) => k,
                None => return false,
            };
            match map.get(&key) {
                Some(s) => s.child.clone(),
                None => return false,
            }
        };
        // Map lock is released. Probe OS process liveness.
        // Save result to a local first so the MutexGuard drops before child_arc.
        let alive = if let Ok(mut guard) = child_arc.try_lock() {
            let r = matches!(guard.try_wait(), Ok(None));
            drop(guard);
            r
        } else {
            true // watcher holds the lock → assume alive
        };
        alive
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

        // If already running for this agent and no prompt, verify the OS process is
        // actually still alive, then re-emit status so the frontend can reattach.
        // IMPORTANT: only skip spawning if the process is genuinely alive —
        // if the child has already exited (but the watcher hasn't cleaned it yet)
        // we must fall through and spawn a fresh PTY. Returning early for a dead
        // session is the root cause of the "cursor only / no output" symptom.
        if prompt.is_none() {
            // Clone what we need from the map (child Arc + pid) before dropping the lock.
            let existing_info = {
                let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                map.get(&agent_id).map(|s| (s.child.clone(), s.pid))
            };

            if let Some((child_arc, pid)) = existing_info {
                // Probe OS process liveness — map lock is now released.
                // Explicit drop ensures MutexGuard is released before child_arc is dropped.
                let process_alive = if let Ok(mut guard) = child_arc.try_lock() {
                    let r = matches!(guard.try_wait(), Ok(None));
                    drop(guard);
                    r
                } else {
                    true // watcher holds the lock → assume alive
                };

                if process_alive {
                    dbg_log!("[ORBIT DEBUG] Reattaching to existing live session PID={}", pid);
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
                } else {
                    dbg_log!("[ORBIT DEBUG] Stale session found (process dead) — spawning fresh PTY for agent_id={}", agent_id);
                    // Fall through: terminate stale entry and spawn fresh below
                }
            }
        }

        dbg_log!("[ORBIT DEBUG] Terminating old session...");
        // Terminate any existing session before starting fresh
        self.terminate(&agent_id);

        let cwd = if Path::new(&workspace_path).is_dir() {
            workspace_path.clone()
        } else if !workspace_path.trim().is_empty() && std::fs::create_dir_all(&workspace_path).is_ok() {
            workspace_path.clone()
        } else {
            std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
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
        let active_role = self.get_role(&agent_id);

        let role_directive = match active_role.as_str() {
            "architect" => "ROLE: SYSTEM ARCHITECT. You are in PLAN ONLY mode. You must ONLY produce specifications, architecture docs, and failing test contracts. You are STRICTLY FORBIDDEN from creating or modifying source code in this mode.",
            "reviewer" => "ROLE: CODE REVIEWER. You are in AUDIT ONLY mode. You must ONLY inspect git diffs, security vulnerabilities, and code quality. You are STRICTLY FORBIDDEN from creating or modifying source code in this mode.",
            "implementer" | "code" => "ROLE: TDD IMPLEMENTER. Write minimal, type-safe code to make failing tests turn green without adding unapproved packages.",
            _ => "",
        };

        let (mut cmd_builder, is_shell_process) = match prov.as_str() {
            "antigravity" => {
                if let Some(bin) = find_executable(&["agy", "antigravity"], &[]) {
                    let mut cmd = CommandBuilder::new(bin);
                    if active_role == "architect" || active_role == "reviewer" {
                        cmd.arg("--mode");
                        cmd.arg("plan");
                    } else if active_role == "implementer" || active_role == "code" {
                        cmd.arg("--mode");
                        cmd.arg("accept-edits");
                    }
                    (cmd, false)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "claude" => {
                if let Some(bin) = find_executable(&["claude"], &[]) {
                    let mut cmd = CommandBuilder::new(bin);
                    if active_role == "architect" || active_role == "reviewer" {
                        cmd.arg("--permission-mode");
                        cmd.arg("plan");
                    }
                    (cmd, false)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "codex" | "openai-codex" => {
                if let Some(bin) = find_executable(&["codex", "openai-codex", "@openai/codex"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(&bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "opencode" | "opencode-ai" => {
                if let Some(bin) = find_executable(&["opencode", "opencode-ai"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "kilocode" | "kilo" | "@kilocode/cli" => {
                if let Some(bin) = find_executable(&["kilocode", "kilo", "@kilocode/cli"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "freebuff" | "freebuff-ai" | "freebuff-cli" => {
                if let Some(bin) = find_executable(&["freebuff", "freebuff-ai", "freebuff-cli"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "cline" => {
                if let Some(bin) = find_executable(&["cline"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "copilot" | "github-copilot" | "github-copilot-cli" | "gh-copilot" => {
                let copilot_bin = find_executable(&["copilot", "github-copilot", "github-copilot-cli", "gh-copilot"], &[])
                    .filter(|p| !is_unusable_sandbox_shim(p));
                if let Some(bin) = copilot_bin {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "goose" | "goose-ai" => {
                if let Some(bin) = find_executable(&["goose", "goose-ai"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "kiro" | "kiro-cli" => {
                if let Some(bin) = find_executable(&["kiro-cli", "kiro"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "qwen" | "qwen-code" | "qwen-agent" => {
                if let Some(bin) = find_executable(&["qwen-code", "qwen", "qwen-agent"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "mimo" | "mimo-cli" | "mimocode" => {
                if let Some(bin) = find_executable(&["mimo", "mimo-cli", "mimocode"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "muse" | "muse-cli" | "musecode" => {
                if let Some(bin) = find_executable(&["muse", "muse-cli", "musecode"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "continue" | "cn" | "continuedev" => {
                if let Some(bin) = find_executable(&["continue", "cn", "continuedev"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "aider" | "aider-chat" => {
                if let Some(bin) = find_executable(&["aider", "aider-chat"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "vibe" | "mistral-vibe" | "vibe-cli" => {
                if let Some(bin) = find_executable(&["vibe", "mistral-vibe", "vibe-cli"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    } else {
                        cmd.env("PYTHONUNBUFFERED", "1");
                        cmd.env("PYTHONIOENCODING", "utf-8");
                        let user_home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                        cmd.env("VIBE_HOME", format!("{}/.vibe", user_home));
                        if let Ok(dbus) = std::env::var("DBUS_SESSION_BUS_ADDRESS") {
                            cmd.env("DBUS_SESSION_BUS_ADDRESS", dbus);
                        }
                        let vibe_env_path = format!("{}/.vibe/.env", user_home);
                        if let Ok(env_contents) = std::fs::read_to_string(&vibe_env_path) {
                            for line in env_contents.lines() {
                                if let Some((k, v)) = line.splitn(2, '=').collect::<Vec<_>>().split_first().and_then(|(k, rest)| {
                                    rest.first().map(|v| (k.trim(), v.trim().trim_matches('"')))
                                }) {
                                    if !k.starts_with('#') && !k.is_empty() {
                                        cmd.env(k, v);
                                    }
                                }
                            }
                        }
                        cmd.arg("--trust");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            "qoder" | "qoder-cli" | "qodercli" => {
                if let Some(bin) = find_executable(&["qodercli", "qoder", "qoder-cli", "qoder_cli"], &[]) {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[]).unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]).unwrap_or_else(|| Path::new("bash").to_path_buf());
                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
            custom_or_shell => {
                let parts: Vec<&str> = custom_or_shell.split_whitespace().collect();
                let bin_token = if parts.is_empty() { custom_or_shell } else { parts[0] };
                let custom_bin = find_executable(&[bin_token], &[]);

                if let Some(bin) = custom_bin {
                    let is_shell = bin
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "bash" || n == "sh" || n == "zsh")
                        .unwrap_or(false);
                    let mut cmd = CommandBuilder::new(bin);
                    if is_shell {
                        cmd.arg("-i");
                    }
                    if parts.len() > 1 {
                        for arg in &parts[1..] {
                            cmd.arg(arg);
                        }
                    }
                    (cmd, is_shell)
                } else {
                    #[cfg(target_os = "windows")]
                    let bin = find_executable(&["powershell", "cmd"], &[])
                        .unwrap_or_else(|| Path::new("powershell.exe").to_path_buf());
                    #[cfg(not(target_os = "windows"))]
                    let bin = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"])
                        .unwrap_or_else(|| Path::new("bash").to_path_buf());

                    let mut cmd = CommandBuilder::new(bin);
                    #[cfg(not(target_os = "windows"))]
                    cmd.arg("-i");
                    (cmd, true)
                }
            }
        };

        // Build augmented PATH: prepends all user tool dirs (NVM, cargo, pnpm, bun, Orbit engines…)
        // so node-based CLIs with #!/usr/bin/env node work from the GUI desktop launcher.
        let host_path = get_augmented_host_path();

        // Explicitly remove conflicting prefix and global config variables
        cmd_builder.env_remove("npm_config_prefix");
        cmd_builder.env_remove("NPM_CONFIG_PREFIX");
        cmd_builder.env_remove("NPM_CONFIG_GLOBALCONFIG");
        cmd_builder.env_remove("npm_config_globalconfig");
        cmd_builder.env_remove("ANTIGRAVITY_AGENT_ID");
        cmd_builder.env_remove("JETSKI_AGENT_ID");
        cmd_builder.env_remove("AI_AGENT");

        for (key, value) in std::env::vars() {
            // Strip active session tokens, connection addresses, and conflicting npm prefix vars
            if key.starts_with("ANTIGRAVITY_")
                || key.starts_with("JETSKI_")
                || key == "AI_AGENT"
                || key == "npm_config_prefix"
                || key == "NPM_CONFIG_PREFIX"
                || key == "NPM_CONFIG_GLOBALCONFIG"
                || key == "npm_config_globalconfig"
            {
                continue;
            }
            cmd_builder.env(key, value);
        }

        // Apply the fully augmented PATH — overrides what the host env vars loop may have set
        cmd_builder.env("PATH", &host_path);
        dbg_log!("[ORBIT PTY] Augmented PATH={}", &host_path[..host_path.len().min(300)]);

        // Apply isolated profile environment sandbox only if a custom profile is explicitly specified
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

                // Disable DBUS / GNOME Keyring fallback so custom sandbox profile doesn't leak host keyring
                cmd_builder.env("DBUS_SESSION_BUS_ADDRESS", "disabled:");
                cmd_builder.env("GNOME_KEYRING_CONTROL", "");
                cmd_builder.env("PYTHON_KEYRING_BACKEND", "keyring.backends.null.Keyring");

                dbg_log!("[ORBIT PROFILE] Isolated custom sandbox mounted at: {}", prof_str);
            }
        }

        cmd_builder.cwd(&cwd);
        cmd_builder.env("TERM", "xterm-256color");
        cmd_builder.env("COLORTERM", "truecolor");
        cmd_builder.env("LINES", rows_val.to_string());
        cmd_builder.env("COLUMNS", cols_val.to_string());
        cmd_builder.env("ORBIT_WORKSPACE_ID", &workspace_id);
        cmd_builder.env("ORBIT_AGENT_ID", &agent_id);

        // Spawn PTY process
        let child = pair.slave.spawn_command(cmd_builder)
            .map_err(|e| format!("Failed to spawn command in PTY: {}", e))?;

        let pid = child.process_id().unwrap_or(0);
        dbg_log!("[ORBIT DEBUG] Child spawned with PID={}", pid);

        // Take the writer
        let writer = pair.master.take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;
        dbg_log!("[ORBIT DEBUG] Writer taken");

        // Clone reader immediately so the master PTY read channel is actively open before child writes
        let initial_reader = pair.master.try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

        // Store the master PTY — for resize operations
        let master_box = pair.master;

        // Full-screen/interactive TUI agents and raw shells must receive raw keystrokes and
        // NO role prelude. These agents render their own input UI; injecting a
        // `[ORBIT CONTINUOUS INVARIANT]` prelude mid-startup crashes/hangs the TUI, and
        // buffering keystrokes in `line_buffer` swallows typed input entirely.
        let is_direct_cli = prov == "terminal" || prov == "shell"
            // All 16 modern interactive TUI CLIs — manage their own input, pass keystrokes raw
            || prov == "antigravity" || prov == "agy"
            || prov == "claude"
            || prov == "codex" || prov == "openai-codex"
            || prov == "opencode"
            || prov == "kilocode" || prov == "kilo" || prov == "@kilocode/cli"
            || prov == "freebuff" || prov == "freebuff-ai" || prov == "freebuff-cli"
            || prov == "cline"
            || prov == "copilot" || prov == "github-copilot" || prov == "github-copilot-cli" || prov == "gh-copilot"
            || prov == "goose" || prov == "goose-ai"
            || prov == "kiro" || prov == "kiro-cli"
            || prov == "qwen" || prov == "qwen-code" || prov == "qwen-agent"
            || prov == "mimo" || prov == "mimo-cli" || prov == "mimocode"
            || prov == "muse" || prov == "muse-cli" || prov == "musecode"
            || prov == "vibe" || prov == "mistral-vibe" || prov == "vibe-cli"
            || prov == "qoder" || prov == "qoder-cli" || prov == "qodercli"
            || is_shell_process;

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
            is_direct_cli,
        );

        let _child_arc = session.child.clone();
        let _history_arc = session.output_history.clone();
        let _master_arc = session.master.clone(); // for reader + resize
        let writer_for_initial_prompt = session.writer.clone();

        // Feed initial prompt: for raw shell terminals, only send explicit prompt
        let mode_prelude = if is_direct_cli {
            prompt_to_send
        } else if !role_directive.is_empty() {
            if let Some(ref p) = prompt_to_send {
                if !p.trim().is_empty() {
                    Some(format!("[ORBIT CONTINUOUS INVARIANT: {}]\nTask: {}", role_directive, p.trim()))
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            prompt_to_send
        };

        if let Some(p) = mode_prelude {
            if !p.trim().is_empty() {
                let p_clone = p.clone();
                // Full-screen TUI agents (Textual/Rich) need 1.5-2s to mount their input
                // box; injecting a prompt at 800ms lands mid-startup and hangs the TUI
                // (the Mistral Vibe crash class). Shell terminals are instant.
                let is_tui_cli = prov == "mimo" || prov == "mimo-cli" || prov == "mimocode"
                    || prov == "qwen" || prov == "qwen-code" || prov == "qwen-agent"
                    || prov == "muse" || prov == "muse-cli" || prov == "musecode"
                    || prov == "qoder" || prov == "qoder-cli" || prov == "qodercli"
                    || prov == "cline"
                    || prov == "kilocode" || prov == "kilo" || prov == "@kilocode/cli"
                    || prov == "freebuff" || prov == "freebuff-ai" || prov == "freebuff-cli"
                    || prov == "copilot" || prov == "github-copilot" || prov == "github-copilot-cli" || prov == "gh-copilot"
                    || prov == "goose" || prov == "goose-ai"
                    || prov == "kiro" || prov == "kiro-cli";
                let is_mimo = prov == "mimo" || prov == "mimo-cli" || prov == "mimocode";
                let delay = if is_mimo {
                    5000
                } else if prov == "opencode" {
                    2200
                } else if prov == "vibe" || prov == "mistral-vibe" {
                    1800
                } else if is_tui_cli {
                    2000
                } else {
                    800
                };
                thread::spawn(move || {
                    // A panic here would poison the shared writer mutex; swallow it.
                    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        thread::sleep(std::time::Duration::from_millis(delay));
                        if let Ok(mut w) = writer_for_initial_prompt.lock() {
                            let _ = w.write_all(p_clone.as_bytes());
                            let _ = w.write_all(b"\r");
                            let _ = w.flush();
                        }
                    }));
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
        let writer_for_terminal_queries = session.writer.clone();

        {
            let mut map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
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
        let mut reader = initial_reader;
        dbg_log!("[ORBIT DEBUG] Spawning reader thread...");
        thread::spawn(move || {
            // (reader_tx, coalescer_rx): the reader thread pushes raw chunks into a channel;
            // a separate coalescer thread drains them and emits a SINGLE batched
            // `agent-output` IPC event every ~16ms. This removes the per-4KB-chunk IPC
            // event storm that starved the webview when running many high-output agent
            // CLIs on low-end hardware.
            let (reader_tx, coalescer_rx) = mpsc::channel::<(String, i64)>();

            let app_coalescer = app_reader.clone();
            let agent_id_coalescer = agent_id_reader.clone();
            let session_id_coalescer = session_id_reader.clone();
            let coalescer_handle = thread::spawn(move || {
                let mut pending: String = String::new();
                loop {
                    match coalescer_rx.recv_timeout(Duration::from_millis(16)) {
                        Ok((chunk, ts)) => {
                            pending.push_str(&chunk);
                            // Drain any additional chunks already buffered so bursts are
                            // coalesced into one write before we emit.
                            while let Ok((extra, _)) = coalescer_rx.try_recv() {
                                pending.push_str(&extra);
                            }
                            if !pending.is_empty() {
                                let _ = app_coalescer.emit(
                                    "agent-output",
                                    AgentOutputEvent {
                                        agent_id: agent_id_coalescer.clone(),
                                        session_id: session_id_coalescer.clone(),
                                        stream: "stdout".to_string(),
                                        text: std::mem::take(&mut pending),
                                        timestamp: ts,
                                    },
                                );
                            }
                        }
                        Err(RecvTimeoutError::Timeout) => {
                            if !pending.is_empty() {
                                let _ = app_coalescer.emit(
                                    "agent-output",
                                    AgentOutputEvent {
                                        agent_id: agent_id_coalescer.clone(),
                                        session_id: session_id_coalescer.clone(),
                                        stream: "stdout".to_string(),
                                        text: std::mem::take(&mut pending),
                                        timestamp: chrono_now_millis(),
                                    },
                                );
                            }
                        }
                        Err(RecvTimeoutError::Disconnected) => {
                            if !pending.is_empty() {
                                let _ = app_coalescer.emit(
                                    "agent-output",
                                    AgentOutputEvent {
                                        agent_id: agent_id_coalescer.clone(),
                                        session_id: session_id_coalescer.clone(),
                                        stream: "stdout".to_string(),
                                        text: std::mem::take(&mut pending),
                                        timestamp: chrono_now_millis(),
                                    },
                                );
                            }
                            break;
                        }
                    }
                }
            });
            drop(coalescer_handle);

            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk_bytes = &buf[..n];

                        // Emulate terminal query auto-responses (DSR, Kitty keyboard/graphics, OSC 10/11 color queries, DECRQM modes, XTGETTCAP)
                        // so modern interactive TUI CLIs (Jetski/Bubbletea, OpenTUI, Ink, Textual) never freeze waiting for terminal capabilities.
                        if let Some(resp) = generate_terminal_query_responses(chunk_bytes) {
                            if let Ok(mut w) = writer_for_terminal_queries.lock() {
                                let _ = w.write_all(&resp);
                                let _ = w.flush();
                            }
                        }

                        let chunk = String::from_utf8_lossy(chunk_bytes).to_string();

                        // Append to history buffer with memory safety cap (UTF-8 char boundary safe)
                        if let Ok(mut hist) = history_arc.lock() {
                            if hist.len() > 40_000 {
                                let mut cut = 20_000;
                                while cut > 0 && !hist.is_char_boundary(cut) {
                                    cut -= 1;
                                }
                                if cut > 0 {
                                    hist.drain(..cut);
                                } else {
                                    hist.clear();
                                }
                            }
                            hist.push_str(&chunk);
                        }

                        // Feed chunk into deterministic activity detector (lock-light now;
                        // Git state is refreshed by a background thread, never here).
                        let out_evt = SessionEvent::new(
                            &session_id_reader,
                            &agent_id_reader,
                            &workspace_id_reader,
                            SessionEventType::AgentOutput,
                            serde_json::json!({ "text": chunk }),
                        );
                        detector_reader.process_event(&out_evt, &workspace_path_reader);

                        let ts = chrono_now_millis();
                        if reader_tx.send((chunk, ts)).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            drop(reader_tx);
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
                thread::sleep(std::time::Duration::from_millis(500));
                let mut guard = child_arc.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                match guard.try_wait() {
                    Ok(Some(status)) => {
                        let exit_code = if status.success() { 0 } else { 1 };

                        // A previous watcher can finish after this agent has already
                        // been respawned. Never let that stale watcher emit an exited
                        // status for, or remove, the replacement PTY session.
                        let owns_current_session = {
                            let map = sessions_for_watcher
                                .lock()
                                .unwrap_or_else(std::sync::PoisonError::into_inner);
                            map.get(&agent_id_watcher)
                                .map(|session| {
                                    session.session_id == session_id_watcher && session.pid == pid
                                })
                                .unwrap_or(false)
                        };
                        if !owns_current_session {
                            dbg_log!(
                                "[ORBIT DEBUG] Ignoring stale watcher exit agent_id={} session_id={} pid={}",
                                agent_id_watcher,
                                session_id_watcher,
                                pid
                            );
                            break;
                        }

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

            let mut map = sessions_for_watcher.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
            let owns_current_session = map
                .get(&agent_id_watcher)
                .map(|session| session.session_id == session_id_watcher && session.pid == pid)
                .unwrap_or(false);
            if owns_current_session {
                map.remove(&agent_id_watcher);
            } else {
                dbg_log!(
                    "[ORBIT DEBUG] Preserving replacement session agent_id={} session_id={} pid={}",
                    agent_id_watcher,
                    session_id_watcher,
                    pid
                );
            }
        });

        dbg_log!("[ORBIT DEBUG] Returning Ok(pid={}) from create_session", pid);
        Ok(pid)
    }

    pub fn write(&self, agent_id: &str, data: &str) -> Result<(), String> {
        self.write_with_fallback(agent_id, "", data)
    }

    pub fn write_with_fallback(&self, agent_id: &str, session_id: &str, data: &str) -> Result<(), String> {
        dbg_log!(
            "[ORBIT DEBUG] PTY write requested agent_id={} session_id={} bytes={}",
            agent_id,
            session_id,
            data.len()
        );
        let current_role = self.get_role(agent_id);
        let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);

        let target_key = Self::find_session_key(&map, agent_id)
            .or_else(|| if !session_id.is_empty() { Self::find_session_key(&map, session_id) } else { None });

        if let Some(key) = target_key {
            if let Some(session) = map.get(&key) {
                // If in Plan (architect) or Review (reviewer) mode, buffer characters until
                // Enter key is pressed. SKIPPED entirely for full-screen TUI agents (Mimo, Vibe,
                // Qwen, …) and raw shells — those render their own input box, so every keystroke
                // must pass through raw or the agent appears to swallow all typed input.
                if !session.direct_cli && (current_role == "architect" || current_role == "reviewer") {
                    let mut buf_guard = session.line_buffer.lock().unwrap_or_else(std::sync::PoisonError::into_inner);

                    for ch in data.chars() {
                        if ch == '\r' || ch == '\n' {
                            let full_line = buf_guard.trim().to_string();
                            buf_guard.clear();

                            // Detect file redirection or destructive file mutation patterns
                            let is_mutation = full_line.contains(" > ")
                                || full_line.contains(" >> ")
                                || full_line.starts_with(">")
                                || full_line.contains(" | tee ")
                                || full_line.contains("sed -i")
                                || full_line.contains("rm -rf")
                                || full_line.contains("rm -f")
                                || (full_line.starts_with("rm ") && !full_line.contains("--help"));

                            if is_mutation {
                                dbg_log!("[ORBIT GUARD BLOCK] Blocked mutating command in role '{}': {}", current_role, full_line);
                                let mut writer = session.writer.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                                let warning_msg = format!(
                                    "\r\n\x1b[1;33m[ORBIT ROLE GUARD]\x1b[0m File mutation is blocked in \x1b[1;35m{} Mode\x1b[0m. Switch to \x1b[1;32mCode Mode\x1b[0m to apply changes.\r\n",
                                    current_role.to_uppercase()
                                );
                                let _ = writer.write_all(b"\x03"); // Cancel current command line
                                let _ = writer.write_all(warning_msg.as_bytes());
                                let _ = writer.flush();
                                return Ok(());
                            }
                        } else if ch == '\x08' || ch == '\x7f' {
                            // Backspace support
                            buf_guard.pop();
                        } else if ch == '\x03' {
                            // Ctrl+C clears line buffer
                            buf_guard.clear();
                        } else {
                            buf_guard.push(ch);
                        }
                    }
                }

                let mut writer = session.writer.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                writer
                    .write_all(data.as_bytes())
                    .map_err(|e| {
                        dbg_log!(
                            "[ORBIT DEBUG] PTY write failed agent_id={} session_id={} error={}",
                            agent_id,
                            session.session_id,
                            e
                        );
                        format!("Failed to write to PTY: {}", e)
                    })?;
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

                return Ok(());
            }
        }
        dbg_log!(
            "[ORBIT DEBUG] PTY write rejected: no active session agent_id={} session_id={}",
            agent_id,
            session_id
        );
        Err("No active PTY session found for agent".to_string())
    }

    pub fn resize(&self, agent_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let target_key = Self::find_session_key(&map, agent_id);
        if let Some(key) = target_key {
            if let Some(session) = map.get(&key) {
                let master = session.master.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                master
                    .resize(PtySize {
                        rows: if rows > 0 { rows } else { 30 },
                        cols: if cols > 0 { cols } else { 100 },
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|e| format!("Failed to resize PTY: {}", e))?;
                return Ok(());
            }
        }
        Err("No active PTY session found to resize".to_string())
    }

    pub fn interrupt(&self, agent_id: &str) -> Result<(), String> {
        let map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let target_key = Self::find_session_key(&map, agent_id);
        if let Some(key) = target_key {
            if let Some(session) = map.get(&key) {
                let mut writer = session.writer.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                // Send ETX (Ctrl+C) to pseudo-terminal
                writer
                    .write_all(b"\x03")
                    .map_err(|e| format!("Failed to write SIGINT to PTY: {}", e))?;
                let _ = writer.flush();
                return Ok(());
            }
        }
        Err("No active PTY session found to interrupt".to_string())
    }

    pub fn terminate(&self, agent_id: &str) {
        let mut map = self.sessions.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let target_key = Self::find_session_key(&map, agent_id);
        if let Some(key) = target_key {
            if let Some(session) = map.remove(&key) {
                let mut child = session.child.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                let _ = child.kill();
            }
        }
    }
}

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn workspace_paths_contains(paths: &[String], candidate: &str) -> bool {
    paths.iter().any(|p| p.as_str() == candidate)
}

fn generate_terminal_query_responses(data: &[u8]) -> Option<Vec<u8>> {
    let mut resp = Vec::new();

    // 1. Device Status Report (DSR) Cursor Position Query: \x1b[6n or \x1b[?6n
    if data.windows(4).any(|w| w == b"\x1b[6n") || data.windows(5).any(|w| w == b"\x1b[?6n") {
        resp.extend_from_slice(b"\x1b[1;1R");
    }

    // 2. DSR Status Query: \x1b[5n -> terminal OK
    if data.windows(4).any(|w| w == b"\x1b[5n") {
        resp.extend_from_slice(b"\x1b[0n");
    }

    // 3. Kitty Keyboard Protocol Query: \x1b[?u
    if data.windows(4).any(|w| w == b"\x1b[?u") {
        resp.extend_from_slice(b"\x1b[?0u");
    }

    // 4. Kitty Graphics Query: \x1b[?996n
    if data.windows(7).any(|w| w == b"\x1b[?996n") {
        resp.extend_from_slice(b"\x1b[?996;0n");
    }

    // 5. ModifyOtherKeys / XTerm Key Queries: \x1b[>4m, \x1b[>4;2m, \x1b[>4;1m
    if data.windows(5).any(|w| w == b"\x1b[>4m")
        || data.windows(7).any(|w| w == b"\x1b[>4;2m" || w == b"\x1b[>4;1m")
    {
        resp.extend_from_slice(b"\x1b[>4;0m");
    }

    // 6. DECSNLS (Screen size report query): \x1b[?5W
    if data.windows(5).any(|w| w == b"\x1b[?5W") {
        resp.extend_from_slice(b"\x1b[?24;80;0;0;0;0W");
    }

    // 7. Window size query: \x1b[14t (pixel size), \x1b[18t (char size)
    if data.windows(5).any(|w| w == b"\x1b[14t") {
        resp.extend_from_slice(b"\x1b[4;480;800t");
    }
    if data.windows(5).any(|w| w == b"\x1b[18t") {
        resp.extend_from_slice(b"\x1b[8;24;80t");
    }

    // 8. Primary Device Attributes: \x1b[c or \x1b[0c
    if data.windows(3).any(|w| w == b"\x1b[c") || data.windows(4).any(|w| w == b"\x1b[0c") {
        resp.extend_from_slice(b"\x1b[?1;2c");
    }

    // 9. Secondary Device Attributes: \x1b[>c or \x1b[>0c
    if data.windows(4).any(|w| w == b"\x1b[>c") || data.windows(5).any(|w| w == b"\x1b[>0c") {
        resp.extend_from_slice(b"\x1b[>0;0;0c");
    }

    // 10. OSC 10 Foreground Color Query: \x1b]10;?
    if data.windows(6).any(|w| w == b"\x1b]10;?") || data.windows(5).any(|w| w == b"]10;?") {
        resp.extend_from_slice(b"\x1b]10;rgb:ffff/ffff/ffff\x1b\\");
    }

    // 11. OSC 11 Background Color Query: \x1b]11;?
    if data.windows(6).any(|w| w == b"\x1b]11;?") || data.windows(5).any(|w| w == b"]11;?") {
        resp.extend_from_slice(b"\x1b]11;rgb:1818/1b1b/2626\x1b\\");
    }

    // 12. XTGETTCAP Termcap/Terminfo Query: \x1bP+q
    if data.windows(4).any(|w| w == b"\x1bP+q") {
        resp.extend_from_slice(b"\x1bP0+r\x1b\\");
    }

    // String-based query parsing with lossy UTF-8 decoding so partial bytes never cause failure
    let s = String::from_utf8_lossy(data);

    // 13. OSC 4 Palette queries: \x1b]4;<index>;?
    if s.contains("]4;") && s.contains(";?") {
        for i in 0..16 {
            let pat = format!("]4;{};?", i);
            if s.contains(&pat) {
                resp.extend_from_slice(format!("\x1b]4;{};rgb:8888/8888/8888\x1b\\", i).as_bytes());
            }
        }
    }

    // 14. DECRQM mode queries: \x1b[?<digits>$p
    // Status '2' in DECRPM (\x1b[?<digits>;2$y) indicates the mode IS recognized/supported and currently reset.
    if s.contains("$p") && s.contains("[?") {
        let mut remaining = s.as_ref();
        while let Some(pos) = remaining.find("[?") {
            let sub = &remaining[pos + 2..];
            if let Some(dollar_pos) = sub.find("$p") {
                let mode_str = &sub[..dollar_pos];
                if mode_str.chars().all(|c| c.is_ascii_digit()) && !mode_str.is_empty() {
                    resp.extend_from_slice(format!("\x1b[?{};2$y", mode_str).as_bytes());
                }
                remaining = &sub[dollar_pos + 2..];
            } else {
                break;
            }
        }
    }

    if resp.is_empty() {
        None
    } else {
        Some(resp)
    }
}
