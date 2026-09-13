use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCell {
    pub text: String,
    pub foreground: TerminalColor,
    pub background: TerminalColor,
    pub attributes: u16,
    pub width: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRow {
    pub row: u16,
    pub cells: Vec<TerminalCell>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CursorState {
    pub row: u16,
    pub column: u16,
    pub visible: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TerminalModes {
    pub bracketed_paste: bool,
    pub alternate_screen: bool,
    pub app_cursor: bool,
    pub mouse_click: bool,
    pub mouse_drag: bool,
    pub mouse_motion: bool,
    pub sgr_mouse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSnapshot {
    pub session_id: String,
    pub sequence: u64,
    pub rows: u16,
    pub columns: u16,
    pub cells: Vec<TerminalRow>,
    pub scrollback: Vec<TerminalRow>,
    pub title: Option<String>,
    pub cursor: CursorState,
    pub modes: TerminalModes,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScreenPatch {
    pub session_id: String,
    pub sequence: u64,
    pub rows: u16,
    pub columns: u16,
    pub dirty_rows: Vec<TerminalRow>,
    pub title: Option<String>,
    pub title_changed: bool,
    pub cursor: CursorState,
    pub modes: TerminalModes,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    pub session_id: String,
    pub agent_id: String,
    pub provider: String,
    pub pid: u32,
    pub rows: u16,
    pub columns: u16,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum TerminalEvent {
    Snapshot {
        snapshot: ScreenSnapshot,
    },
    Patch {
        patch: ScreenPatch,
    },
    Lifecycle {
        session_id: String,
        state: String,
        pid: Option<u32>,
        exit_code: Option<i32>,
        message: Option<String>,
    },
}

impl TerminalEvent {
    pub fn session_id(&self) -> &str {
        match self {
            Self::Snapshot { snapshot } => &snapshot.session_id,
            Self::Patch { patch } => &patch.session_id,
            Self::Lifecycle { session_id, .. } => session_id,
        }
    }
}
