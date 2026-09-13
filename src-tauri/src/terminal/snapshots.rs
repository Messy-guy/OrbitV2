use super::protocol::{ScreenSnapshot, TerminalRow};

pub fn dirty_rows(previous: &ScreenSnapshot, current: &ScreenSnapshot) -> Vec<TerminalRow> {
    current
        .cells
        .iter()
        .filter(|row| previous.cells.get(row.row as usize) != Some(row))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::dirty_rows;
    use crate::terminal::emulator::TerminalEmulator;

    #[test]
    fn patch_contains_only_changed_rows() {
        let mut emulator = TerminalEmulator::new(10, 3);
        emulator.feed(b"one\x1b[3;1Hthree");
        let first = emulator.snapshot("s", 1);
        emulator.feed(b"\x1b[1;1HONE");
        let second = emulator.snapshot("s", 2);
        let rows = dirty_rows(&first, &second);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].row, 0);
    }
}
