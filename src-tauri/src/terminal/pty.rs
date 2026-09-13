use portable_pty::{native_pty_system, Child, MasterPty, PtyPair, PtySize};

pub fn open(rows: u16, columns: u16) -> Result<PtyPair, String> {
    native_pty_system()
        .openpty(PtySize {
            rows: rows.max(1),
            cols: columns.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("failed to open PTY: {error}"))
}

/// Terminate the complete PTY foreground process group when the platform
/// exposes one, then fall back to the portable child handle. This prevents a
/// CLI's helper processes from surviving an Orbit session stop on Unix.
pub fn terminate_process_group(
    master: &dyn MasterPty,
    child: &mut (dyn Child + Send + Sync),
) -> Result<(), String> {
    #[cfg(unix)]
    if let Some(group) = master.process_group_leader() {
        let result = unsafe { libc::kill(-group, libc::SIGTERM) };
        if result == 0 {
            return Ok(());
        }
    }
    child
        .kill()
        .map_err(|error| format!("failed to terminate PTY child: {error}"))
}
