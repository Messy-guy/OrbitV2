use std::sync::Arc;

use parking_lot::Mutex;
use tauri::ipc::Channel;
use tauri::AppHandle;

use super::diagnostics::{TerminalDiagnostics, TerminalDiagnosticsSnapshot};
use super::launcher;
use super::protocol::{ScreenSnapshot, TerminalEvent, TerminalSessionInfo};
use super::registry::TerminalRegistry;
use super::session::TerminalSession;

#[derive(Clone, Default)]
pub struct TerminalService {
    registry: TerminalRegistry,
    diagnostics: Arc<TerminalDiagnostics>,
    start_lock: Arc<Mutex<()>>,
}

impl TerminalService {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(
        &self,
        app: Option<AppHandle>,
        session_id: String,
        agent_id: String,
        provider: String,
        cwd: String,
        rows: u16,
        columns: u16,
        role: Option<String>,
        profile_id: Option<String>,
        prompt: Option<String>,
        resume: Option<bool>,
    ) -> Result<TerminalSessionInfo, String> {
        // Normal startup and AgentTerminal attachment can enter through two
        // Tauri commands during the same React commit. Serialize the
        // resolve/replace/insert transaction so those calls cannot each spawn
        // a child and then stop the other's session.
        let _start_guard = self.start_lock.lock();
        if let Some(existing) = self.registry.get(&session_id) {
            if existing.is_running()
                && existing.info.agent_id == agent_id
                && existing.info.provider.eq_ignore_ascii_case(&provider)
                && existing.info.profile_id
                    == profile_id
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)
            {
                return Ok(existing.info.clone());
            }
        }
        let cwd_path = ensure_cwd(&cwd)?;
        let spec = launcher::resolve(
            &provider,
            &cwd_path,
            rows,
            columns,
            role.as_deref(),
            profile_id.as_deref(),
            prompt,
            resume,
        )?;
        // Only replace an existing session after the new provider has been
        // resolved successfully. A missing executable must not destroy a
        // currently healthy terminal.
        self.registry.stop_and_remove(&session_id)?;
        // An agent owns one native PTY at a time. Remove stale sessions before
        // inserting a replacement so agent-based input/resize/interrupt calls
        // cannot resolve an arbitrary older session.
        self.registry.stop_by_agent_except(&agent_id, &session_id)?;
        let session =
            TerminalSession::start(app, session_id, agent_id, spec, self.diagnostics.clone())?;
        let info = session.info.clone();
        self.registry.insert(session);
        Ok(info)
    }

    pub fn attach(&self, session_id: &str, channel: Channel<TerminalEvent>) -> Result<u64, String> {
        self.registry
            .get(session_id)
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .attach(channel)
    }

    pub fn session_for_agent(&self, agent_id: &str) -> Option<Arc<TerminalSession>> {
        self.registry.find_by_agent(agent_id)
    }

    pub fn session_for_input(
        &self,
        agent_id: &str,
        session_id: &str,
    ) -> Option<Arc<TerminalSession>> {
        self.registry
            .get(session_id)
            .or_else(|| self.registry.find_by_agent(agent_id))
            .filter(|session| session.is_running())
    }

    pub fn detach(&self, session_id: &str, subscription_id: u64) -> Result<(), String> {
        self.registry
            .get(session_id)
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .detach(subscription_id)
    }

    pub fn input(&self, session_id: &str, bytes: Vec<u8>) -> Result<(), String> {
        self.registry
            .get(session_id)
            .or_else(|| self.registry.find_by_agent(session_id))
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .input(bytes)
    }

    pub fn resize(&self, session_id: &str, rows: u16, columns: u16) -> Result<(), String> {
        self.registry
            .get(session_id)
            .or_else(|| self.registry.find_by_agent(session_id))
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .resize(rows, columns)
    }

    pub fn interrupt(&self, session_id: &str) -> Result<(), String> {
        self.registry
            .get(session_id)
            .or_else(|| self.registry.find_by_agent(session_id))
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .interrupt()
    }

    pub fn stop(&self, session_id: &str) -> Result<(), String> {
        self.registry.stop_and_remove(session_id)
    }

    pub fn snapshot(&self, session_id: &str) -> Result<ScreenSnapshot, String> {
        self.registry
            .get(session_id)
            .ok_or_else(|| format!("terminal session '{session_id}' is not registered"))?
            .snapshot()
    }

    pub fn stop_agent(&self, agent_id: &str) -> Result<(), String> {
        if let Some(session) = self.registry.find_by_agent(agent_id) {
            self.registry.stop_and_remove(&session.info.session_id)
        } else {
            Ok(())
        }
    }

    pub fn stop_provider(&self, provider: &str) -> Result<(), String> {
        self.registry.stop_by_provider(provider)
    }

    pub fn diagnostics(&self) -> Arc<TerminalDiagnostics> {
        self.diagnostics.clone()
    }

    pub fn diagnostics_snapshot(&self) -> TerminalDiagnosticsSnapshot {
        self.diagnostics.snapshot()
    }
}

fn ensure_cwd(cwd: &str) -> Result<std::path::PathBuf, String> {
    let path = if cwd.trim().is_empty() {
        std::env::var_os("HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
    } else {
        std::path::PathBuf::from(cwd)
    };
    if path.is_dir() {
        Ok(path)
    } else {
        Err(format!(
            "terminal workspace does not exist: {}",
            path.display()
        ))
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::TerminalService;
    use std::thread;
    use std::time::{Duration, Instant};

    #[test]
    fn reuses_an_existing_native_session_instead_of_spawning_a_duplicate() {
        let service = TerminalService::new();
        let first = service
            .start(
                None,
                "session-reuse".to_string(),
                "agent-reuse".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("first native session should start");
        let second = service
            .start(
                None,
                "session-reuse".to_string(),
                "agent-reuse".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("second start should reuse the native session");

        assert_eq!(first.pid, second.pid);
        service.stop("session-reuse").unwrap();
    }

    #[test]
    fn replacement_session_removes_the_previous_session_for_the_agent() {
        let service = TerminalService::new();
        let first = service
            .start(
                None,
                "session-old".to_string(),
                "agent-replace".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("first native session should start");
        let second = service
            .start(
                None,
                "session-new".to_string(),
                "agent-replace".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("replacement native session should start");

        assert!(service.snapshot(&first.session_id).is_err());
        assert_eq!(
            service
                .session_for_agent("agent-replace")
                .expect("replacement should own the agent")
                .info
                .session_id,
            second.session_id
        );
        service.stop("session-new").unwrap();
    }

    #[test]
    fn failed_replacement_keeps_the_existing_session_alive() {
        let service = TerminalService::new();
        let info = service
            .start(
                None,
                "session-safe".to_string(),
                "agent-safe".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("initial native session should start");

        let error = service.start(
            None,
            "session-safe".to_string(),
            "agent-safe".to_string(),
            "missing-provider-for-replacement".to_string(),
            "/tmp".to_string(),
            8,
            40,
            None,
            None,
            None,
            None,
        );
        assert!(error.is_err());
        assert!(service
            .session_for_agent("agent-safe")
            .expect("healthy session must remain registered")
            .is_running());
        service.stop(&info.session_id).unwrap();
    }

    #[test]
    fn remote_input_resolution_accepts_session_or_agent_identity() {
        let service = TerminalService::new();
        let info = service
            .start(
                None,
                "session-remote".to_string(),
                "agent-remote".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                40,
                None,
                None,
                None,
                None,
            )
            .expect("native session should start");

        assert_eq!(
            service
                .session_for_input("agent-remote", "session-remote")
                .expect("exact session identity should resolve")
                .info
                .session_id,
            info.session_id
        );
        assert_eq!(
            service
                .session_for_input("agent-remote", "legacy-session-id")
                .expect("agent identity fallback should resolve")
                .info
                .session_id,
            info.session_id
        );
        service.stop("session-remote").unwrap();
    }

    #[test]
    fn remote_input_resolution_writes_to_the_native_pty_and_renders_once() {
        let service = TerminalService::new();
        let info = service
            .start(
                None,
                "session-remote-pty".to_string(),
                "agent-remote-pty".to_string(),
                "sh".to_string(),
                "/tmp".to_string(),
                8,
                80,
                None,
                None,
                None,
                None,
            )
            .expect("native shell session should start");

        let session = service
            .session_for_input("agent-remote-pty", "remote-request-session")
            .expect("remote agent identity should resolve to the native session");
        session
            .input(b"printf remote-control-parity\r".to_vec())
            .expect("remote input should be written through the native arbiter");

        let deadline = Instant::now() + Duration::from_secs(2);
        let mut rendered = String::new();
        while Instant::now() < deadline {
            rendered = service
                .snapshot(&info.session_id)
                .expect("native snapshot should remain available")
                .cells
                .iter()
                .flat_map(|row| row.cells.iter())
                .filter(|cell| cell.width != 0)
                .map(|cell| cell.text.as_str())
                .collect();
            if rendered.contains("remote-control-parity") {
                break;
            }
            thread::sleep(Duration::from_millis(20));
        }

        assert!(
            rendered.contains("remote-control-parity"),
            "remote input was not rendered by the native PTY: {rendered:?}"
        );
        service.stop(&info.session_id).unwrap();
    }
}
