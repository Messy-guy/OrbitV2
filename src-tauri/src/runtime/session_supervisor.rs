use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionPhase {
    Created,
    Spawning,
    PtyReady,
    Booting,
    Ready,
    Running,
    Exited,
    Failed,
}

impl SessionPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Spawning => "spawning",
            Self::PtyReady => "pty_ready",
            Self::Booting => "booting",
            Self::Ready => "ready",
            Self::Running => "running",
            Self::Exited => "exited",
            Self::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone)]
pub struct SessionLifecycle {
    pub phase: SessionPhase,
    pub created_at: i64,
    pub first_output_at: Option<i64>,
    pub last_output_at: Option<i64>,
    pub output_bytes: u64,
    pub terminal_query_responses: u32,
    pub last_error: Option<String>,
}

impl SessionLifecycle {
    pub fn new() -> Self {
        Self {
            phase: SessionPhase::Created,
            created_at: now_millis(),
            first_output_at: None,
            last_output_at: None,
            output_bytes: 0,
            terminal_query_responses: 0,
            last_error: None,
        }
    }

    pub fn transition(&mut self, phase: SessionPhase) {
        self.phase = phase;
        if phase == SessionPhase::Ready && self.first_output_at.is_none() {
            self.first_output_at = Some(now_millis());
        }
    }

    pub fn fail(&mut self, error: impl Into<String>) {
        self.phase = SessionPhase::Failed;
        self.last_error = Some(error.into());
    }

    pub fn record_output(&mut self, byte_count: usize) {
        let now = now_millis();
        self.output_bytes = self.output_bytes.saturating_add(byte_count as u64);
        self.last_output_at = Some(now);
        if self.first_output_at.is_none() {
            self.first_output_at = Some(now);
        }
        if self.phase == SessionPhase::Booting || self.phase == SessionPhase::PtyReady {
            self.phase = SessionPhase::Ready;
        }
    }

    pub fn record_terminal_query_response(&mut self) {
        self.terminal_query_responses = self.terminal_query_responses.saturating_add(1);
    }
}

pub type SharedSessionLifecycle = Arc<Mutex<SessionLifecycle>>;

pub fn new_shared_lifecycle() -> SharedSessionLifecycle {
    Arc::new(Mutex::new(SessionLifecycle::new()))
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{new_shared_lifecycle, SessionPhase};

    #[test]
    fn lifecycle_records_first_output_and_failure() {
        let lifecycle = new_shared_lifecycle();
        {
            let mut state = lifecycle.lock().unwrap();
            state.transition(SessionPhase::Booting);
            state.transition(SessionPhase::Ready);
            assert_eq!(state.phase.as_str(), "ready");
            assert!(state.first_output_at.is_some());
            state.record_output(42);
            assert_eq!(state.output_bytes, 42);
            assert!(state.last_output_at.is_some());
            state.record_terminal_query_response();
            assert_eq!(state.terminal_query_responses, 1);
            state.fail("reader failed");
            assert_eq!(state.phase.as_str(), "failed");
            assert_eq!(state.last_error.as_deref(), Some("reader failed"));
        }
    }
}
