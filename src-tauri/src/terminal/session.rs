use std::collections::HashMap;
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use parking_lot::RwLock;
use portable_pty::{MasterPty, PtySize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};

use super::diagnostics::TerminalDiagnostics;
use super::emulator::TerminalEmulator;
use super::input::InputArbiter;
use super::launcher::LaunchSpec;
use super::protocol::{ScreenPatch, ScreenSnapshot, TerminalEvent, TerminalSessionInfo};
use super::pty;
use super::snapshots;

enum SessionCommand {
    Attach {
        channel: Channel<TerminalEvent>,
        reply: SyncSender<Result<u64, String>>,
    },
    Detach(u64),
    Input(Vec<u8>, SyncSender<Result<(), String>>),
    Resize(u16, u16, SyncSender<Result<(), String>>),
    Interrupt(SyncSender<Result<(), String>>),
    Stop(SyncSender<Result<(), String>>),
    Snapshot(SyncSender<Result<ScreenSnapshot, String>>),
    History(SyncSender<Result<String, String>>),
}

enum ReaderMessage {
    Bytes(Vec<u8>),
    Eof,
    Error(String),
}

pub struct TerminalSession {
    pub info: TerminalSessionInfo,
    command_tx: Sender<SessionCommand>,
    alive: Arc<AtomicBool>,
    retained_snapshot: Arc<RwLock<Option<ScreenSnapshot>>>,
    retained_history: Arc<RwLock<String>>,
}

impl TerminalSession {
    pub fn start(
        app: Option<AppHandle>,
        session_id: String,
        agent_id: String,
        spec: LaunchSpec,
        diagnostics: Arc<TerminalDiagnostics>,
    ) -> Result<Arc<Self>, String> {
        let (command_tx, command_rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        let alive = Arc::new(AtomicBool::new(true));
        let worker_alive = alive.clone();
        let retained_snapshot = Arc::new(RwLock::new(None));
        let worker_snapshot = retained_snapshot.clone();
        let retained_history = Arc::new(RwLock::new(String::new()));
        let worker_history = retained_history.clone();
        let worker_session_id = session_id.clone();
        let worker_agent_id = agent_id.clone();
        let worker_spec = spec.clone();
        thread::Builder::new()
            .name(format!("orbit-terminal-{session_id}"))
            .spawn(move || {
                worker_loop(
                    worker_session_id,
                    worker_agent_id,
                    worker_spec,
                    command_rx,
                    ready_tx,
                    diagnostics,
                    worker_alive,
                    app,
                    worker_snapshot,
                    worker_history,
                )
            })
            .map_err(|error| format!("failed to start terminal worker: {error}"))?;

        let info = ready_rx
            .recv()
            .map_err(|_| "terminal worker exited before reporting readiness".to_string())??;
        Ok(Arc::new(Self {
            info,
            command_tx,
            alive,
            retained_snapshot,
            retained_history,
        }))
    }

    pub fn attach(&self, channel: Channel<TerminalEvent>) -> Result<u64, String> {
        if !self.is_running() {
            let snapshot = self
                .retained_snapshot
                .read()
                .clone()
                .ok_or_else(|| "terminal session has no retained snapshot".to_string())?;
            return channel
                .send(TerminalEvent::Snapshot { snapshot })
                .map(|_| 0)
                .map_err(|error| format!("failed to send retained terminal snapshot: {error}"));
        }
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.command_tx
            .send(SessionCommand::Attach {
                channel,
                reply: reply_tx,
            })
            .map_err(|_| "terminal session is not running".to_string())?;
        reply_rx
            .recv()
            .map_err(|_| "terminal attach failed".to_string())?
    }

    pub fn detach(&self, subscription_id: u64) -> Result<(), String> {
        self.command_tx
            .send(SessionCommand::Detach(subscription_id))
            .map_err(|_| "terminal session is not running".to_string())
    }

    pub fn input(&self, bytes: Vec<u8>) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.command_tx
            .send(SessionCommand::Input(bytes, reply_tx))
            .map_err(|_| "terminal session is not running".to_string())?;
        reply_rx
            .recv()
            .map_err(|_| "terminal input failed".to_string())?
    }

    pub fn resize(&self, rows: u16, columns: u16) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.command_tx
            .send(SessionCommand::Resize(rows, columns, reply_tx))
            .map_err(|_| "terminal session is not running".to_string())?;
        reply_rx
            .recv()
            .map_err(|_| "terminal resize failed".to_string())?
    }

    pub fn interrupt(&self) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.command_tx
            .send(SessionCommand::Interrupt(reply_tx))
            .map_err(|_| "terminal session is not running".to_string())?;
        reply_rx
            .recv()
            .map_err(|_| "terminal interrupt failed".to_string())?
    }

    pub fn stop(&self) -> Result<(), String> {
        if !self.is_running() {
            return Ok(());
        }
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.command_tx
            .send(SessionCommand::Stop(reply_tx))
            .map_err(|_| "terminal session is not running".to_string())?;
        reply_rx
            .recv()
            .map_err(|_| "terminal stop failed".to_string())?
    }

    pub fn snapshot(&self) -> Result<ScreenSnapshot, String> {
        if !self.is_running() {
            return self
                .retained_snapshot
                .read()
                .clone()
                .ok_or_else(|| "terminal session has no retained snapshot".to_string());
        }
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        if self
            .command_tx
            .send(SessionCommand::Snapshot(reply_tx))
            .is_err()
        {
            return self
                .retained_snapshot
                .read()
                .clone()
                .ok_or_else(|| "terminal session is not running".to_string());
        }
        reply_rx.recv().unwrap_or_else(|_| {
            self.retained_snapshot
                .read()
                .clone()
                .ok_or_else(|| "terminal snapshot failed".to_string())
        })
    }

    pub fn history(&self) -> Result<String, String> {
        if !self.is_running() {
            return Ok(self.retained_history.read().clone());
        }
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        if self
            .command_tx
            .send(SessionCommand::History(reply_tx))
            .is_err()
        {
            return Ok(self.retained_history.read().clone());
        }
        reply_rx
            .recv()
            .unwrap_or_else(|_| Ok(self.retained_history.read().clone()))
    }

    pub fn is_running(&self) -> bool {
        self.alive.load(Ordering::Acquire)
    }
}

fn worker_loop(
    session_id: String,
    agent_id: String,
    spec: LaunchSpec,
    command_rx: Receiver<SessionCommand>,
    ready_tx: SyncSender<Result<TerminalSessionInfo, String>>,
    diagnostics: Arc<TerminalDiagnostics>,
    alive: Arc<AtomicBool>,
    app: Option<AppHandle>,
    retained_snapshot: Arc<RwLock<Option<ScreenSnapshot>>>,
    retained_history: Arc<RwLock<String>>,
) {
    let _alive_guard = AliveGuard(alive);
    let pair = match pty::open(spec.rows, spec.columns) {
        Ok(pair) => pair,
        Err(error) => {
            let _ = ready_tx.send(Err(error));
            diagnostics
                .launch_failures
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };
    let mut child = match pair.slave.spawn_command(spec.command()) {
        Ok(child) => child,
        Err(error) => {
            let _ = ready_tx.send(Err(format!("failed to spawn '{}': {error}", spec.provider)));
            diagnostics
                .launch_failures
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };
    let pid = child.process_id().unwrap_or(0);
    let reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(error) => {
            let _ = child.kill();
            let _ = ready_tx.send(Err(format!("failed to open PTY reader: {error}")));
            return;
        }
    };
    let writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(error) => {
            let _ = child.kill();
            let _ = ready_tx.send(Err(format!("failed to open PTY writer: {error}")));
            return;
        }
    };
    // The worker owns the PTY master and child. A cloned reader is the only
    // object crossing into the blocking read thread; output comes back through
    // the worker command queue below.
    let (output_tx, output_rx) = mpsc::channel::<ReaderMessage>();
    thread::spawn(move || read_loop(reader, output_tx));

    let info = TerminalSessionInfo {
        session_id: session_id.clone(),
        agent_id,
        provider: spec.provider,
        pid,
        rows: spec.rows,
        columns: spec.columns,
        profile_id: spec.profile_id.clone(),
    };
    diagnostics
        .sessions_started
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let mut emulator = TerminalEmulator::new(spec.columns, spec.rows);
    let initial_snapshot = emulator.snapshot(&session_id, 0);
    *retained_snapshot.write() = Some(initial_snapshot.clone());
    *retained_history.write() = snapshot_text(&initial_snapshot);
    let _ = ready_tx.send(Ok(info.clone()));
    let output_agent_id = info.agent_id.clone();

    let mut input = InputArbiter::new(writer);
    let mut subscribers: HashMap<u64, Channel<TerminalEvent>> = HashMap::new();
    let mut next_subscription_id = 1_u64;
    let mut sequence = 0_u64;
    let mut last_snapshot: Option<ScreenSnapshot> = Some(initial_snapshot);
    let mut dirty = false;
    let mut reader_closed: Option<String> = None;
    let mut reader_failed = false;
    let mut first_output_emitted = false;
    let mut initial_prompt = spec
        .initial_prompt
        .as_deref()
        .filter(|prompt| !prompt.trim().is_empty())
        .map(|prompt| {
            let mut bytes = prompt.as_bytes().to_vec();
            bytes.push(b'\r');
            bytes
        });
    let prompt_due = Instant::now() + Duration::from_millis(spec.startup_delay_ms);
    let prompt_fallback_due = prompt_due + Duration::from_secs(5);

    loop {
        if initial_prompt.is_some()
            && Instant::now() >= prompt_due
            && (first_output_emitted || Instant::now() >= prompt_fallback_due)
        {
            if let Some(bytes) = initial_prompt.take() {
                let _ = input.write(&bytes);
            }
        }
        while let Ok(message) = output_rx.try_recv() {
            match message {
                ReaderMessage::Bytes(bytes) => {
                    emit_compat_output(app.as_ref(), &output_agent_id, &session_id, &bytes);
                    emit_first_output_status(
                        app.as_ref(),
                        &output_agent_id,
                        &session_id,
                        pid,
                        &mut first_output_emitted,
                    );
                    diagnostics.record_output(bytes.len());
                    emulator.feed(&bytes);
                    for response in emulator.drain_writes() {
                        let _ = input.write(&response);
                    }
                    dirty = true;
                }
                ReaderMessage::Eof => {
                    reader_closed = Some("PTY reader closed".to_string());
                    break;
                }
                ReaderMessage::Error(message) => {
                    diagnostics
                        .reader_failures
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    reader_failed = true;
                    reader_closed = Some(message);
                    break;
                }
            }
        }

        if dirty {
            sequence = sequence.saturating_add(1);
            let snapshot = emulator.snapshot(&session_id, sequence);
            let event = match &last_snapshot {
                None => TerminalEvent::Snapshot {
                    snapshot: snapshot.clone(),
                },
                Some(previous)
                    if previous.rows != snapshot.rows || previous.columns != snapshot.columns =>
                {
                    TerminalEvent::Snapshot {
                        snapshot: snapshot.clone(),
                    }
                }
                Some(previous) => TerminalEvent::Patch {
                    patch: ScreenPatch {
                        session_id: session_id.clone(),
                        sequence,
                        rows: snapshot.rows,
                        columns: snapshot.columns,
                        dirty_rows: snapshots::dirty_rows(previous, &snapshot),
                        title: snapshot.title.clone(),
                        title_changed: previous.title != snapshot.title,
                        cursor: snapshot.cursor,
                        modes: snapshot.modes,
                    },
                },
            };
            publish(&mut subscribers, event);
            last_snapshot = Some(snapshot);
            if let Some(snapshot) = &last_snapshot {
                *retained_snapshot.write() = Some(snapshot.clone());
                *retained_history.write() = snapshot_text(snapshot);
            }
            diagnostics.record_update();
            dirty = false;
        }

        while let Ok(command) = command_rx.try_recv() {
            if !handle_command(
                command,
                &session_id,
                pid,
                &pair.master,
                &mut child,
                &mut emulator,
                &mut input,
                &mut subscribers,
                &mut next_subscription_id,
                &mut sequence,
                &mut last_snapshot,
                &mut dirty,
                &diagnostics,
            ) {
                emit_status(
                    app.as_ref(),
                    &output_agent_id,
                    &session_id,
                    "stopped",
                    Some(pid),
                    None,
                    None,
                );
                let _ = publish_lifecycle(
                    &mut subscribers,
                    &session_id,
                    "stopped",
                    Some(pid),
                    None,
                    None,
                );
                return;
            }
        }

        if reader_closed.is_none() {
            if let Ok(message) = output_rx.recv_timeout(Duration::from_millis(16)) {
                match message {
                    ReaderMessage::Bytes(bytes) => {
                        emit_compat_output(app.as_ref(), &output_agent_id, &session_id, &bytes);
                        emit_first_output_status(
                            app.as_ref(),
                            &output_agent_id,
                            &session_id,
                            pid,
                            &mut first_output_emitted,
                        );
                        diagnostics.record_output(bytes.len());
                        emulator.feed(&bytes);
                        for response in emulator.drain_writes() {
                            let _ = input.write(&response);
                        }
                        dirty = true;
                    }
                    ReaderMessage::Eof => {
                        reader_closed = Some("PTY reader closed".to_string());
                    }
                    ReaderMessage::Error(message) => {
                        diagnostics
                            .reader_failures
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        reader_failed = true;
                        reader_closed = Some(message);
                    }
                }
            }
        }
        // Flush the bytes received in the blocking read before publishing the
        // child exit. Fast commands can print their final screen and exit in
        // the same scheduler turn; returning immediately here would discard
        // that final snapshot.
        if dirty {
            continue;
        }
        if let Ok(Some(status)) = child.try_wait() {
            let code = Some(status.exit_code() as i32);
            let failed = reader_failed;
            emit_status(
                app.as_ref(),
                &output_agent_id,
                &session_id,
                if failed { "error" } else { "exited" },
                Some(pid),
                code,
                reader_closed.clone(),
            );
            let _ = publish_lifecycle(
                &mut subscribers,
                &session_id,
                if failed { "failed" } else { "exited" },
                Some(pid),
                code,
                reader_closed.clone(),
            );
            return;
        }
        if reader_closed.is_some() {
            if reader_failed {
                let _ = child.kill();
            }
            if let Ok(status) = child.wait() {
                let state = if reader_failed { "error" } else { "exited" };
                emit_status(
                    app.as_ref(),
                    &output_agent_id,
                    &session_id,
                    state,
                    Some(pid),
                    Some(status.exit_code() as i32),
                    reader_closed.clone(),
                );
                let _ = publish_lifecycle(
                    &mut subscribers,
                    &session_id,
                    if reader_failed { "failed" } else { "exited" },
                    Some(pid),
                    Some(status.exit_code() as i32),
                    reader_closed.take(),
                );
            }
            return;
        }
    }
}

fn read_loop(mut reader: Box<dyn Read + Send>, output_tx: Sender<ReaderMessage>) {
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => {
                let _ = output_tx.send(ReaderMessage::Eof);
                return;
            }
            Ok(length) => {
                if output_tx
                    .send(ReaderMessage::Bytes(buffer[..length].to_vec()))
                    .is_err()
                {
                    return;
                }
            }
            Err(error) if is_normal_pty_eof(&error) => {
                let _ = output_tx.send(ReaderMessage::Eof);
                return;
            }
            Err(error) => {
                let _ = output_tx.send(ReaderMessage::Error(format!("PTY reader failed: {error}")));
                return;
            }
        }
    }
}

fn is_normal_pty_eof(error: &std::io::Error) -> bool {
    #[cfg(unix)]
    if error.raw_os_error() == Some(5) {
        return true;
    }
    #[cfg(windows)]
    if error.raw_os_error() == Some(109) {
        return true;
    }
    false
}

#[allow(clippy::too_many_arguments)]
fn handle_command(
    command: SessionCommand,
    session_id: &str,
    pid: u32,
    master: &Box<dyn MasterPty + Send>,
    child: &mut Box<dyn portable_pty::Child + Send + Sync>,
    emulator: &mut TerminalEmulator,
    input: &mut InputArbiter,
    subscribers: &mut HashMap<u64, Channel<TerminalEvent>>,
    next_subscription_id: &mut u64,
    sequence: &mut u64,
    last_snapshot: &mut Option<ScreenSnapshot>,
    dirty: &mut bool,
    diagnostics: &Arc<TerminalDiagnostics>,
) -> bool {
    match command {
        SessionCommand::Attach { channel, reply } => {
            let id = *next_subscription_id;
            *next_subscription_id = next_subscription_id.saturating_add(1);
            let snapshot = last_snapshot
                .clone()
                .unwrap_or_else(|| emulator.snapshot(session_id, *sequence));
            // Register before delivering the initial snapshot. The worker is
            // single-threaded, so this also guarantees that the first patch
            // after the snapshot cannot be published to a missing subscriber.
            let subscriber = channel.clone();
            subscribers.insert(id, subscriber);
            let result = channel
                .send(TerminalEvent::Snapshot { snapshot })
                .map(|_| {
                    diagnostics
                        .attach_count
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    let _ = publish_lifecycle(
                        subscribers,
                        session_id,
                        "running",
                        Some(pid),
                        None,
                        None,
                    );
                    id
                })
                .map_err(|error| {
                    subscribers.remove(&id);
                    format!("failed to send terminal snapshot: {error}")
                });
            let _ = reply.send(result);
        }
        SessionCommand::Detach(id) => {
            subscribers.remove(&id);
        }
        SessionCommand::Input(bytes, reply) => {
            let result = input.write(&bytes);
            let _ = reply.send(result);
        }
        SessionCommand::Resize(rows, columns, reply) => {
            let result = master
                .resize(PtySize {
                    rows: rows.max(1),
                    cols: columns.max(1),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|error| format!("PTY resize failed: {error}"));
            if result.is_ok() {
                emulator.resize(columns, rows);
                *dirty = true;
                *last_snapshot = None;
            }
            let _ = reply.send(result);
        }
        SessionCommand::Interrupt(reply) => {
            let result = input.write(&[3]);
            let _ = reply.send(result);
        }
        SessionCommand::Stop(reply) => {
            let result = pty::terminate_process_group(master.as_ref(), child.as_mut());
            let _ = reply.send(result);
            return false;
        }
        SessionCommand::Snapshot(reply) => {
            let _ = reply.send(Ok(emulator.snapshot(session_id, *sequence)));
        }
        SessionCommand::History(reply) => {
            let snapshot = emulator.snapshot(session_id, *sequence);
            let text = snapshot_text(&snapshot);
            let _ = reply.send(Ok(text));
        }
    }
    true
}

fn snapshot_text(snapshot: &ScreenSnapshot) -> String {
    let mut rows = snapshot.scrollback.clone();
    rows.extend(snapshot.cells.clone());
    rows.iter()
        .map(|row| {
            row.cells
                .iter()
                .filter(|cell| cell.width != 0)
                .map(|cell| cell.text.as_str())
                .collect::<String>()
                .trim_end()
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn emit_compat_output(app: Option<&AppHandle>, agent_id: &str, session_id: &str, bytes: &[u8]) {
    if let Some(app) = app {
        let _ = app.emit(
            "agent-output",
            crate::models::AgentOutputEvent {
                agent_id: agent_id.to_string(),
                session_id: session_id.to_string(),
                stream: "stdout".to_string(),
                text: String::from_utf8_lossy(bytes).into_owned(),
                timestamp: now_millis(),
            },
        );
    }
}

fn emit_first_output_status(
    app: Option<&AppHandle>,
    agent_id: &str,
    session_id: &str,
    pid: u32,
    emitted: &mut bool,
) {
    if *emitted {
        return;
    }
    *emitted = true;
    emit_status(
        app,
        agent_id,
        session_id,
        "working",
        Some(pid),
        None,
        Some("First native PTY output received".to_string()),
    );
}

fn emit_status(
    app: Option<&AppHandle>,
    agent_id: &str,
    session_id: &str,
    status: &str,
    pid: Option<u32>,
    exit_code: Option<i32>,
    message: Option<String>,
) {
    if let Some(app) = app {
        let phase = match status {
            "working" => Some("ready"),
            "exited" => Some("exited"),
            "error" => Some("failed"),
            "stopped" => Some("exited"),
            _ => None,
        };
        let _ = app.emit(
            "agent-status",
            crate::models::AgentStatusEvent {
                agent_id: agent_id.to_string(),
                session_id: Some(session_id.to_string()),
                status: status.to_string(),
                phase: phase.map(str::to_string),
                pid,
                exit_code,
                message,
            },
        );
    }
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

struct AliveGuard(Arc<AtomicBool>);

impl Drop for AliveGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn publish(subscribers: &mut HashMap<u64, Channel<TerminalEvent>>, event: TerminalEvent) {
    let mut closed = Vec::new();
    for (id, channel) in subscribers.iter() {
        if channel.send(event.clone()).is_err() {
            closed.push(*id);
        }
    }
    for id in closed {
        subscribers.remove(&id);
    }
}

fn publish_lifecycle(
    subscribers: &mut HashMap<u64, Channel<TerminalEvent>>,
    session_id: &str,
    state: &str,
    pid: Option<u32>,
    exit_code: Option<i32>,
    message: Option<String>,
) -> Result<(), String> {
    publish(
        subscribers,
        TerminalEvent::Lifecycle {
            session_id: session_id.to_string(),
            state: state.to_string(),
            pid,
            exit_code,
            message,
        },
    );
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::{read_loop, TerminalSession};
    use crate::terminal::diagnostics::TerminalDiagnostics;
    use crate::terminal::launcher::LaunchSpec;
    use std::ffi::OsString;
    use std::io::{self, Read};
    use std::path::PathBuf;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    struct FailingReader;

    impl Read for FailingReader {
        fn read(&mut self, _buffer: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::from_raw_os_error(libc::EINVAL))
        }
    }

    struct EioReader;

    impl Read for EioReader {
        fn read(&mut self, _buffer: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::from_raw_os_error(5))
        }
    }

    #[test]
    fn reader_failure_is_distinguished_from_normal_unix_pty_eof() {
        let (tx, rx) = std::sync::mpsc::channel();
        read_loop(Box::new(FailingReader), tx);
        assert!(matches!(rx.recv().unwrap(), super::ReaderMessage::Error(_)));

        let (tx, rx) = std::sync::mpsc::channel();
        read_loop(Box::new(EioReader), tx);
        assert!(matches!(rx.recv().unwrap(), super::ReaderMessage::Eof));
    }

    #[test]
    fn native_pty_session_reads_fake_tui_output_into_the_screen() {
        let spec = LaunchSpec {
            provider: "fake-tui".to_string(),
            executable: PathBuf::from("/bin/sh"),
            args: vec![
                OsString::from("-c"),
                OsString::from("printf 'fake-tui'; sleep 2"),
            ],
            cwd: PathBuf::from("/tmp"),
            env: Vec::new(),
            rows: 4,
            columns: 24,
            initial_prompt: None,
            startup_delay_ms: 0,
            profile_id: None,
        };
        let session = TerminalSession::start(
            None,
            "test-session".to_string(),
            "test-agent".to_string(),
            spec,
            Arc::new(TerminalDiagnostics::default()),
        )
        .expect("native PTY session should start");

        let mut rendered = String::new();
        for _ in 0..30 {
            if let Ok(snapshot) = session.snapshot() {
                rendered = snapshot.cells[0]
                    .cells
                    .iter()
                    .map(|cell| cell.text.as_str())
                    .collect();
                if rendered.contains("fake-tui") {
                    break;
                }
            }
            thread::sleep(Duration::from_millis(20));
        }

        assert!(rendered.contains("fake-tui"), "screen was: {rendered:?}");
        session.stop().expect("native PTY session should stop");
        thread::sleep(Duration::from_millis(20));
        let retained = session.snapshot().expect("final screen should be retained");
        let retained_text = retained.cells[0]
            .cells
            .iter()
            .map(|cell| cell.text.as_str())
            .collect::<String>();
        assert!(retained_text.contains("fake-tui"));
        assert!(session.history().unwrap().contains("fake-tui"));
    }

    #[test]
    fn immediate_exit_still_retains_initial_screen_state() {
        let spec = LaunchSpec {
            provider: "fake-empty".to_string(),
            executable: PathBuf::from("/bin/sh"),
            args: vec![OsString::from("-c"), OsString::from("exit 0")],
            cwd: PathBuf::from("/tmp"),
            env: Vec::new(),
            rows: 4,
            columns: 24,
            initial_prompt: None,
            startup_delay_ms: 0,
            profile_id: None,
        };
        let session = TerminalSession::start(
            None,
            "empty-session".to_string(),
            "empty-agent".to_string(),
            spec,
            Arc::new(TerminalDiagnostics::default()),
        )
        .expect("native empty session should start");

        for _ in 0..50 {
            if !session.is_running() {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        let snapshot = session
            .snapshot()
            .expect("initial screen must remain available after exit");
        assert_eq!((snapshot.rows, snapshot.columns), (4, 24));
        assert!(session.history().is_ok());
    }

    #[test]
    fn concurrent_session_inputs_are_serialized_without_byte_interleaving() {
        let spec = LaunchSpec {
            provider: "echo-test".to_string(),
            executable: PathBuf::from("/bin/sh"),
            args: vec![OsString::from("-c"), OsString::from("stty -echo; cat")],
            cwd: PathBuf::from("/tmp"),
            env: Vec::new(),
            rows: 4,
            columns: 80,
            initial_prompt: None,
            startup_delay_ms: 0,
            profile_id: None,
        };
        let session = TerminalSession::start(
            None,
            "concurrent-session".to_string(),
            "concurrent-agent".to_string(),
            spec,
            Arc::new(TerminalDiagnostics::default()),
        )
        .expect("echo session should start");
        let messages = ["alpha\n", "bravo\n", "charlie\n", "delta\n"];
        let workers = messages
            .iter()
            .map(|message| {
                let session = session.clone();
                let message = message.as_bytes().to_vec();
                thread::spawn(move || session.input(message).unwrap())
            })
            .collect::<Vec<_>>();
        for worker in workers {
            worker.join().expect("input worker should complete");
        }
        let deadline = std::time::Instant::now() + Duration::from_secs(1);
        let mut history = String::new();
        while std::time::Instant::now() < deadline {
            history = session.history().unwrap_or_default();
            if messages
                .iter()
                .all(|message| history.contains(message.trim()))
            {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        for message in messages {
            assert!(
                history.contains(message.trim()),
                "missing {message:?} in {history:?}"
            );
        }
        session.stop().unwrap();
    }
}
