use std::sync::Arc;

use alacritty_terminal::event::{Event, EventListener, WindowSize};
use alacritty_terminal::grid::Dimensions;
use alacritty_terminal::index::{Column, Line};
use alacritty_terminal::term::cell::Flags;
use alacritty_terminal::term::{Config, Term};
use alacritty_terminal::vte::ansi::{Color, NamedColor, Processor, Rgb};
use parking_lot::Mutex;

use super::protocol::{
    CursorState, ScreenSnapshot, TerminalCell, TerminalColor, TerminalModes, TerminalRow,
};

#[derive(Clone, Copy)]
struct TerminalDimensions {
    columns: usize,
    rows: usize,
}

impl Dimensions for TerminalDimensions {
    fn total_lines(&self) -> usize {
        self.rows
    }

    fn screen_lines(&self) -> usize {
        self.rows
    }

    fn columns(&self) -> usize {
        self.columns
    }
}

#[derive(Clone)]
struct EventSink {
    writes: Arc<Mutex<Vec<Vec<u8>>>>,
    title: Arc<Mutex<Option<String>>>,
    size: Arc<Mutex<(u16, u16)>>,
}

impl EventSink {
    fn new(columns: u16, rows: u16) -> Self {
        Self {
            writes: Arc::new(Mutex::new(Vec::new())),
            title: Arc::new(Mutex::new(None)),
            size: Arc::new(Mutex::new((columns.max(1), rows.max(1)))),
        }
    }
}

impl EventListener for EventSink {
    fn send_event(&self, event: Event) {
        match event {
            Event::PtyWrite(text) => self.writes.lock().push(text.into_bytes()),
            Event::Title(title) => *self.title.lock() = Some(title),
            Event::ResetTitle => *self.title.lock() = None,
            Event::ColorRequest(index, formatter) => {
                let color = if index == NamedColor::Background as usize {
                    Rgb { r: 9, g: 10, b: 15 }
                } else if index == NamedColor::Foreground as usize {
                    Rgb {
                        r: 228,
                        g: 228,
                        b: 231,
                    }
                } else if index == NamedColor::Cursor as usize {
                    Rgb {
                        r: 228,
                        g: 228,
                        b: 231,
                    }
                } else if index < 16 {
                    let c = named_color(index_to_named_color(index as u8));
                    Rgb { r: c.r, g: c.g, b: c.b }
                } else {
                    let c = indexed_color((index & 0xff) as u8);
                    Rgb { r: c.r, g: c.g, b: c.b }
                };
                self.writes.lock().push(formatter(color).into_bytes());
            }
            Event::TextAreaSizeRequest(formatter) => {
                let (num_cols, num_lines) = *self.size.lock();
                self.writes.lock().push(
                    formatter(WindowSize {
                        num_lines,
                        num_cols,
                        cell_width: 8,
                        cell_height: 17,
                    })
                    .into_bytes(),
                );
            }
            _ => {}
        }
    }
}

pub struct TerminalEmulator {
    parser: Processor,
    term: Term<EventSink>,
    event_sink: EventSink,
}

impl TerminalEmulator {
    pub fn new(columns: u16, rows: u16) -> Self {
        let event_sink = EventSink::new(columns, rows);
        let dimensions = TerminalDimensions {
            columns: columns.max(1) as usize,
            rows: rows.max(1) as usize,
        };
        let term = Term::new(Config::default(), &dimensions, event_sink.clone());
        Self {
            parser: Processor::new(),
            term,
            event_sink,
        }
    }

    pub fn feed(&mut self, bytes: &[u8]) {
        self.parser.advance(&mut self.term, bytes);
    }

    pub fn resize(&mut self, columns: u16, rows: u16) {
        *self.event_sink.size.lock() = (columns.max(1), rows.max(1));
        self.term.resize(TerminalDimensions {
            columns: columns.max(1) as usize,
            rows: rows.max(1) as usize,
        });
    }

    pub fn drain_writes(&self) -> Vec<Vec<u8>> {
        std::mem::take(&mut *self.event_sink.writes.lock())
    }

    pub fn snapshot(&mut self, session_id: &str, sequence: u64) -> ScreenSnapshot {
        let rows = self.term.screen_lines();
        let columns = self.term.columns();
        let cells = (0..rows)
            .map(|row| TerminalRow {
                row: row as u16,
                cells: (0..columns)
                    .map(|column| {
                        let cell = &self.term.grid()[Line(row as i32)][Column(column)];
                        TerminalCell {
                            text: cell.c.to_string(),
                            foreground: color_to_rgba(cell.fg),
                            background: color_to_rgba(cell.bg),
                            attributes: cell.flags.bits(),
                            width: if cell.flags.contains(Flags::WIDE_CHAR) {
                                2
                            } else if cell.flags.contains(Flags::WIDE_CHAR_SPACER) {
                                0
                            } else {
                                1
                            },
                        }
                    })
                    .collect(),
            })
            .collect();
        // Keep a bounded copy of scrollback in the protocol so a renderer
        // recreation can recover terminal state without replaying raw ANSI.
        // The emulator remains the source of truth; the visible grid above is
        // still the only data required for the normal 60 FPS paint path.
        let history = self.term.grid().history_size();
        let history_start = -(history.min(2500) as i32);
        let scrollback = (history_start..0)
            .map(|line| TerminalRow {
                row: (line - history_start) as u16,
                cells: (0..columns)
                    .map(|column| {
                        let cell = &self.term.grid()[Line(line)][Column(column)];
                        TerminalCell {
                            text: cell.c.to_string(),
                            foreground: color_to_rgba(cell.fg),
                            background: color_to_rgba(cell.bg),
                            attributes: cell.flags.bits(),
                            width: if cell.flags.contains(Flags::WIDE_CHAR) {
                                2
                            } else if cell.flags.contains(Flags::WIDE_CHAR_SPACER) {
                                0
                            } else {
                                1
                            },
                        }
                    })
                    .collect(),
            })
            .collect();
        let point = self.term.grid().cursor.point;
        let snapshot = ScreenSnapshot {
            session_id: session_id.to_string(),
            sequence,
            rows: rows as u16,
            columns: columns as u16,
            cells,
            scrollback,
            title: self.event_sink.title.lock().clone(),
            cursor: CursorState {
                row: point.line.0.max(0) as u16,
                column: point.column.0 as u16,
                visible: self
                    .term
                    .mode()
                    .contains(alacritty_terminal::term::TermMode::SHOW_CURSOR),
            },
            modes: terminal_modes(self.term.mode()),
        };
        snapshot
    }
}

fn terminal_modes(mode: &alacritty_terminal::term::TermMode) -> TerminalModes {
    use alacritty_terminal::term::TermMode;
    TerminalModes {
        bracketed_paste: mode.contains(TermMode::BRACKETED_PASTE),
        alternate_screen: mode.contains(TermMode::ALT_SCREEN),
        app_cursor: mode.contains(TermMode::APP_CURSOR),
        mouse_click: mode.contains(TermMode::MOUSE_REPORT_CLICK),
        mouse_drag: mode.contains(TermMode::MOUSE_DRAG),
        mouse_motion: mode.contains(TermMode::MOUSE_MOTION),
        sgr_mouse: mode.contains(TermMode::SGR_MOUSE),
    }
}

fn color_to_rgba(color: Color) -> TerminalColor {
    match color {
        Color::Spec(Rgb { r, g, b }) => TerminalColor { r, g, b, a: 255 },
        Color::Indexed(index) => indexed_color(index),
        Color::Named(name) => named_color(name),
    }
}

fn named_color(name: NamedColor) -> TerminalColor {
    const COLORS: [(u8, u8, u8); 16] = [
        (40, 44, 52),     // 0: Black (modern dark charcoal so it doesn't vanish on #090a0f)
        (224, 108, 117),  // 1: Red
        (152, 195, 121),  // 2: Green
        (229, 192, 123),  // 3: Yellow
        (97, 175, 239),   // 4: Blue (vibrant, clearly legible on dark canvas)
        (198, 120, 221),  // 5: Magenta
        (86, 182, 194),   // 6: Cyan
        (220, 223, 228),  // 7: White
        (92, 99, 112),    // 8: BrightBlack / Gray (zinc-500 equivalent)
        (239, 113, 122),  // 9: BrightRed
        (168, 209, 137),  // 10: BrightGreen
        (240, 203, 134),  // 11: BrightYellow
        (113, 187, 247),  // 12: BrightBlue
        (210, 135, 232),  // 13: BrightMagenta
        (102, 194, 205),  // 14: BrightCyan
        (255, 255, 255),  // 15: BrightWhite
    ];

    match name {
        NamedColor::Background => TerminalColor {
            r: 9,
            g: 10,
            b: 15,
            a: 255,
        },
        NamedColor::Foreground | NamedColor::Cursor => TerminalColor {
            r: 228,
            g: 228,
            b: 231,
            a: 255,
        },
        NamedColor::BrightForeground => TerminalColor {
            r: 255,
            g: 255,
            b: 255,
            a: 255,
        },
        NamedColor::DimForeground => TerminalColor {
            r: 130,
            g: 133,
            b: 144,
            a: 255,
        },
        NamedColor::DimBlack => {
            let (r, g, b) = COLORS[0];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimRed => {
            let (r, g, b) = COLORS[1];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimGreen => {
            let (r, g, b) = COLORS[2];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimYellow => {
            let (r, g, b) = COLORS[3];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimBlue => {
            let (r, g, b) = COLORS[4];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimMagenta => {
            let (r, g, b) = COLORS[5];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimCyan => {
            let (r, g, b) = COLORS[6];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        NamedColor::DimWhite => {
            let (r, g, b) = COLORS[7];
            TerminalColor { r: r * 2 / 3, g: g * 2 / 3, b: b * 2 / 3, a: 255 }
        },
        _ => {
            let index = name as usize;
            if index < COLORS.len() {
                let (r, g, b) = COLORS[index];
                TerminalColor { r, g, b, a: 255 }
            } else {
                TerminalColor {
                    r: 228,
                    g: 228,
                    b: 231,
                    a: 255,
                }
            }
        }
    }
}

fn index_to_named_color(index: u8) -> NamedColor {
    match index {
        0 => NamedColor::Black,
        1 => NamedColor::Red,
        2 => NamedColor::Green,
        3 => NamedColor::Yellow,
        4 => NamedColor::Blue,
        5 => NamedColor::Magenta,
        6 => NamedColor::Cyan,
        7 => NamedColor::White,
        8 => NamedColor::BrightBlack,
        9 => NamedColor::BrightRed,
        10 => NamedColor::BrightGreen,
        11 => NamedColor::BrightYellow,
        12 => NamedColor::BrightBlue,
        13 => NamedColor::BrightMagenta,
        14 => NamedColor::BrightCyan,
        _ => NamedColor::BrightWhite,
    }
}

fn indexed_color(index: u8) -> TerminalColor {
    if index < 16 {
        let name = match index {
            0 => NamedColor::Black,
            1 => NamedColor::Red,
            2 => NamedColor::Green,
            3 => NamedColor::Yellow,
            4 => NamedColor::Blue,
            5 => NamedColor::Magenta,
            6 => NamedColor::Cyan,
            7 => NamedColor::White,
            8 => NamedColor::BrightBlack,
            9 => NamedColor::BrightRed,
            10 => NamedColor::BrightGreen,
            11 => NamedColor::BrightYellow,
            12 => NamedColor::BrightBlue,
            13 => NamedColor::BrightMagenta,
            14 => NamedColor::BrightCyan,
            _ => NamedColor::BrightWhite,
        };
        return named_color(name);
    }
    if index >= 232 {
        let value = 8 + (index - 232) * 10;
        return TerminalColor {
            r: value,
            g: value,
            b: value,
            a: 255,
        };
    }
    let cube = index - 16;
    let r = cube / 36;
    let g = (cube % 36) / 6;
    let b = cube % 6;
    let component = |value: u8| if value == 0 { 0 } else { 55 + value * 40 };
    TerminalColor {
        r: component(r),
        g: component(g),
        b: component(b),
        a: 255,
    }
}

#[cfg(test)]
mod tests {
    use super::TerminalEmulator;

    #[test]
    fn parses_text_and_cursor_without_frontend_ansi_parsing() {
        let mut emulator = TerminalEmulator::new(12, 3);
        emulator.feed(b"hello\x1b[2;3Hworld");
        let snapshot = emulator.snapshot("test", 1);
        assert_eq!(snapshot.cells[0].cells[0].text, "h");
        assert_eq!(snapshot.cells[1].cells[2].text, "w");
        assert_eq!(snapshot.cursor.row, 1);
        assert_eq!(snapshot.cursor.column, 7);
    }

    #[test]
    fn generates_device_status_response() {
        let mut emulator = TerminalEmulator::new(10, 4);
        emulator.feed(b"\x1b[6n");
        assert_eq!(emulator.drain_writes(), vec![b"\x1b[1;1R".to_vec()]);
    }

    #[test]
    fn tracks_title_changes() {
        let mut emulator = TerminalEmulator::new(10, 4);
        emulator.feed(b"\x1b]2;Orbit\x07");
        assert_eq!(emulator.snapshot("test", 1).title.as_deref(), Some("Orbit"));
        emulator.feed(b"\x1b]2;\x07");
        assert_eq!(emulator.snapshot("test", 2).title, Some(String::new()));
    }

    #[test]
    fn preserves_unicode_and_alternate_screen_state() {
        let mut emulator = TerminalEmulator::new(12, 3);
        emulator.feed("λ界".as_bytes());
        let primary = emulator.snapshot("test", 1);
        assert_eq!(primary.cells[0].cells[0].text, "λ");
        emulator.feed(b"\x1b[?1049hALT\x1b[?1049l");
        let restored = emulator.snapshot("test", 2);
        assert_eq!(restored.cells[0].cells[0].text, "λ");
    }

    #[test]
    fn resize_changes_the_canonical_screen_dimensions() {
        let mut emulator = TerminalEmulator::new(10, 3);
        emulator.resize(20, 5);
        let snapshot = emulator.snapshot("test", 1);
        assert_eq!((snapshot.columns, snapshot.rows), (20, 5));
    }

    #[test]
    fn exposes_bounded_scrollback_for_reattach() {
        let mut emulator = TerminalEmulator::new(10, 3);
        emulator.feed(b"one\r\ntwo\r\nthree\r\nfour\r\nfive\r\n");
        let snapshot = emulator.snapshot("test", 1);
        assert!(!snapshot.scrollback.is_empty());
        assert!(snapshot.scrollback.len() <= 2500);
    }

    #[test]
    fn generates_correct_dark_background_and_light_foreground_responses() {
        let mut emulator = TerminalEmulator::new(10, 3);
        // OSC 11: Background query
        emulator.feed(b"\x1b]11;?\x07");
        let writes = emulator.drain_writes();
        assert_eq!(writes.len(), 1);
        let resp = String::from_utf8_lossy(&writes[0]);
        assert!(resp.starts_with("\x1b]11;rgb:0909/0a0a/0f0f"), "Background query must return dark background, got: {}", resp);

        // OSC 10: Foreground query
        emulator.feed(b"\x1b]10;?\x07");
        let writes = emulator.drain_writes();
        assert_eq!(writes.len(), 1);
        let resp = String::from_utf8_lossy(&writes[0]);
        assert!(resp.starts_with("\x1b]10;rgb:e4e4/e4e4/e7e7"), "Foreground query must return light foreground, got: {}", resp);
    }
}
