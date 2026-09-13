use std::io::Write;

/// The only writer used by a native terminal session.  Local keyboard input,
/// remote control input, and emulator-generated capability replies all enter
/// the session command queue and are serialized by the worker before reaching
/// the PTY.
pub struct InputArbiter {
    writer: Box<dyn Write + Send>,
}

impl InputArbiter {
    pub fn new(writer: Box<dyn Write + Send>) -> Self {
        Self { writer }
    }

    pub fn write(&mut self, bytes: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(bytes)
            .map_err(|error| format!("terminal input write failed: {error}"))?;
        self.writer
            .flush()
            .map_err(|error| format!("terminal input flush failed: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::InputArbiter;
    use std::io::{Result as IoResult, Write};
    use std::sync::{Arc, Mutex};

    struct RecordingWriter(Arc<Mutex<Vec<u8>>>);

    impl Write for RecordingWriter {
        fn write(&mut self, bytes: &[u8]) -> IoResult<usize> {
            self.0.lock().unwrap().extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> IoResult<()> {
            Ok(())
        }
    }

    #[test]
    fn preserves_input_bytes_without_utf8_round_tripping() {
        let output = Arc::new(Mutex::new(Vec::new()));
        let mut arbiter = InputArbiter::new(Box::new(RecordingWriter(output.clone())));
        let first = [0x00, 0xff, 0x1b, 0x5b, 0x41];
        let second = [0x0d, 0x0a, 0x03];

        arbiter.write(&first).unwrap();
        arbiter.write(&second).unwrap();

        assert_eq!(
            *output.lock().unwrap(),
            [first.as_slice(), second.as_slice()].concat()
        );
    }
}
