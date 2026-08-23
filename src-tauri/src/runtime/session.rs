use std::io::Write;
use std::sync::{Arc, Mutex};
use portable_pty::{Child, MasterPty};

#[allow(dead_code)]
pub struct PtySession {
    pub session_id: String,
    pub workspace_id: String,
    pub workspace_path: String,
    pub agent_id: String,
    pub pid: u32,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    pub output_history: Arc<Mutex<String>>,
    pub line_buffer: Arc<Mutex<String>>,
    pub rows: u16,
    pub cols: u16,
    pub created_at: i64,
}

impl PtySession {
    pub fn new(
        session_id: String,
        workspace_id: String,
        workspace_path: String,
        agent_id: String,
        pid: u32,
        writer: Box<dyn Write + Send>,
        master: Box<dyn MasterPty + Send>,
        child: Box<dyn Child + Send + Sync>,
        rows: u16,
        cols: u16,
    ) -> Self {
        Self {
            session_id,
            workspace_id,
            workspace_path,
            agent_id,
            pid,
            writer: Arc::new(Mutex::new(writer)),
            master: Arc::new(Mutex::new(master)),
            child: Arc::new(Mutex::new(child)),
            output_history: Arc::new(Mutex::new(String::new())),
            line_buffer: Arc::new(Mutex::new(String::new())),
            rows,
            cols,
            created_at: chrono_now_millis(),
        }
    }
}

fn chrono_now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
