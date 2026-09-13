//! Native terminal runtime.
//!
//! This subsystem deliberately owns terminal emulation and screen state.  It
//! is additive during the migration: the existing `PtyManager` and remote
//! control writer remain available until the new runtime has passed the
//! packaged-provider matrix.

pub mod diagnostics;
pub mod emulator;
pub mod input;
pub mod launcher;
pub mod protocol;
pub mod pty;
pub mod registry;
pub mod service;
pub mod session;
pub mod smoke;
pub mod snapshots;

pub use protocol::{TerminalEvent, TerminalSessionInfo};
pub use service::TerminalService;
