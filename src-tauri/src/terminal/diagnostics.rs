use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
pub struct TerminalDiagnostics {
    pub sessions_started: AtomicU64,
    pub output_bytes: AtomicU64,
    pub screen_updates: AtomicU64,
    pub attach_count: AtomicU64,
    pub launch_failures: AtomicU64,
    pub reader_failures: AtomicU64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDiagnosticsSnapshot {
    pub sessions_started: u64,
    pub output_bytes: u64,
    pub screen_updates: u64,
    pub attach_count: u64,
    pub launch_failures: u64,
    pub reader_failures: u64,
}

impl TerminalDiagnostics {
    pub fn record_output(&self, bytes: usize) {
        self.output_bytes.fetch_add(bytes as u64, Ordering::Relaxed);
    }

    pub fn record_update(&self) {
        self.screen_updates.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> TerminalDiagnosticsSnapshot {
        TerminalDiagnosticsSnapshot {
            sessions_started: self.sessions_started.load(Ordering::Relaxed),
            output_bytes: self.output_bytes.load(Ordering::Relaxed),
            screen_updates: self.screen_updates.load(Ordering::Relaxed),
            attach_count: self.attach_count.load(Ordering::Relaxed),
            launch_failures: self.launch_failures.load(Ordering::Relaxed),
            reader_failures: self.reader_failures.load(Ordering::Relaxed),
        }
    }
}
