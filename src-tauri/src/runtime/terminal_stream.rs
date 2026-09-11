//! Session-scoped raw PTY output transport.
//!
//! This is intentionally independent from agent broadcast events. A terminal
//! view attaches to one concrete session and receives ordered frames with a
//! bounded replay window. Remote control continues to use the existing PTY
//! writer path and is not coupled to this renderer transport.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;

const DEFAULT_HISTORY_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStreamFrame {
    pub session_id: String,
    pub sequence: u64,
    pub kind: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStreamAttach {
    pub subscription_id: u64,
    pub current_sequence: u64,
    pub replayed_from: u64,
}

struct StreamState {
    next_sequence: u64,
    history_bytes: usize,
    history: VecDeque<TerminalStreamFrame>,
    subscribers: HashMap<u64, Channel<TerminalStreamFrame>>,
    next_subscription_id: u64,
}

impl StreamState {
    fn new() -> Self {
        Self {
            next_sequence: 0,
            history_bytes: 0,
            history: VecDeque::new(),
            subscribers: HashMap::new(),
            next_subscription_id: 1,
        }
    }

    fn trim_history(&mut self) {
        while self.history_bytes > DEFAULT_HISTORY_BYTES {
            let Some(frame) = self.history.pop_front() else {
                break;
            };
            self.history_bytes = self.history_bytes.saturating_sub(frame.bytes.len());
        }
    }
}

#[derive(Clone, Default)]
pub struct TerminalStreamBroker {
    streams: Arc<Mutex<HashMap<String, Arc<Mutex<StreamState>>>>>,
}

impl TerminalStreamBroker {
    pub fn new() -> Self {
        Self::default()
    }

    fn stream(&self, session_id: &str) -> Arc<Mutex<StreamState>> {
        let mut streams = self
            .streams
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        streams
            .entry(session_id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(StreamState::new())))
            .clone()
    }

    pub fn publish(&self, session_id: &str, bytes: &[u8]) {
        if bytes.is_empty() {
            return;
        }
        let state = self.stream(session_id);
        let mut state = state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.next_sequence = state.next_sequence.saturating_add(1);
        let frame = TerminalStreamFrame {
            session_id: session_id.to_string(),
            sequence: state.next_sequence,
            kind: "live".to_string(),
            bytes: bytes.to_vec(),
        };
        state.history_bytes = state.history_bytes.saturating_add(frame.bytes.len());
        state.history.push_back(frame.clone());
        state.trim_history();

        let mut closed = Vec::new();
        for (subscription_id, channel) in &state.subscribers {
            if channel.send(frame.clone()).is_err() {
                closed.push(*subscription_id);
            }
        }
        for subscription_id in closed {
            state.subscribers.remove(&subscription_id);
        }
    }

    pub fn publish_exit(&self, session_id: &str) {
        let state = self.stream(session_id);
        let mut state = state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.next_sequence = state.next_sequence.saturating_add(1);
        let frame = TerminalStreamFrame {
            session_id: session_id.to_string(),
            sequence: state.next_sequence,
            kind: "exit".to_string(),
            bytes: Vec::new(),
        };
        let mut closed = Vec::new();
        for (subscription_id, channel) in &state.subscribers {
            if channel.send(frame.clone()).is_err() {
                closed.push(*subscription_id);
            }
        }
        for subscription_id in closed {
            state.subscribers.remove(&subscription_id);
        }
    }

    /// Used only for compatibility fallback capability replies. When a local
    /// xterm is attached it owns terminal query handling; headless/remote-only
    /// sessions may continue using the legacy backend responder.
    pub fn has_subscribers(&self, session_id: &str) -> bool {
        let Some(state) = self
            .streams
            .lock()
            .ok()
            .and_then(|streams| streams.get(session_id).cloned())
        else {
            return false;
        };
        state
            .lock()
            .map(|state| !state.subscribers.is_empty())
            .unwrap_or(false)
    }

    pub fn attach(
        &self,
        session_id: &str,
        from_sequence: u64,
        channel: Channel<TerminalStreamFrame>,
    ) -> Result<TerminalStreamAttach, String> {
        let state = self.stream(session_id);
        let mut state = state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if from_sequence > 0 {
            if let Some(oldest) = state.history.front().map(|frame| frame.sequence) {
                if oldest > from_sequence.saturating_add(1) {
                    return Err(format!(
                        "Terminal output history no longer contains sequence {} (oldest available: {})",
                        from_sequence, oldest
                    ));
                }
            }
        }
        let subscription_id = state.next_subscription_id;
        state.next_subscription_id = state.next_subscription_id.saturating_add(1);

        let mut replayed_from = state.next_sequence.saturating_add(1);
        for frame in state
            .history
            .iter()
            .filter(|frame| frame.sequence > from_sequence)
        {
            replayed_from = replayed_from.min(frame.sequence);
            let mut replay = frame.clone();
            replay.kind = "replay".to_string();
            channel
                .send(replay)
                .map_err(|e| format!("Failed to replay terminal output: {}", e))?;
        }

        // The mutex is held across replay and subscription registration, so no
        // live frame can be inserted between the replay boundary and attach.
        state.subscribers.insert(subscription_id, channel);
        Ok(TerminalStreamAttach {
            subscription_id,
            current_sequence: state.next_sequence,
            replayed_from,
        })
    }

    pub fn detach(&self, session_id: &str, subscription_id: u64) {
        if let Some(state) = self
            .streams
            .lock()
            .ok()
            .and_then(|streams| streams.get(session_id).cloned())
        {
            let mut state = state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            state.subscribers.remove(&subscription_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::TerminalStreamBroker;

    #[test]
    fn publishes_monotonic_sequences_and_keeps_history() {
        let broker = TerminalStreamBroker::new();
        broker.publish("s1", b"one");
        broker.publish("s1", b"two");
        let state = broker.stream("s1");
        let state = state.lock().unwrap();
        assert_eq!(state.next_sequence, 2);
        assert_eq!(state.history.len(), 2);
        assert_eq!(state.history[0].bytes, b"one");
    }
}
