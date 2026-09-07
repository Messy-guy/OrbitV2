use portable_pty::{native_pty_system, PtySize, CommandBuilder};
use std::io::{Read, Write};
use std::time::Duration;

fn main() {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: 30,
        cols: 100,
        pixel_width: 0,
        pixel_height: 0,
    }).unwrap();

    let mut cmd = CommandBuilder::new("/home/leo/.local/bin/agy");
    
    // Simulate what pty_manager.rs did:
    for (key, value) in std::env::vars() {
        if key.starts_with("ANTIGRAVITY_")
            || key.starts_with("JETSKI_")
            || key == "AI_AGENT"
            || key == "npm_config_prefix"
            || key == "NPM_CONFIG_PREFIX"
            || key == "NPM_CONFIG_GLOBALCONFIG"
            || key == "npm_config_globalconfig"
        {
            println!("STRIPPED ENV VAR: {}", key);
            continue;
        }
        cmd.env(key, value);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("LINES", "30");
    cmd.env("COLUMNS", "100");

    let mut child = pair.slave.spawn_command(cmd).unwrap();
    let mut reader = pair.master.try_clone_reader().unwrap();
    let mut writer = pair.master.take_writer().unwrap();

    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => { println!("[EOF]"); break; }
                Ok(n) => {
                    let chunk = buf[..n].to_vec();
                    let _ = tx.send(chunk);
                }
                Err(e) => {
                    println!("[ERR] {:?}", e);
                    break;
                }
            }
        }
    });

    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(6) {
        if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(100)) {
            let s = String::from_utf8_lossy(&chunk);
            print!("{}", s);
            if s.contains("?u") {
                let _ = writer.write_all(b"\x1b[?0u");
            }
            if s.contains("?5W") {
                let _ = writer.write_all(b"\x1b[?24;80;0;0;0;0W");
            }
            if s.contains("$p") {
                let _ = writer.write_all(b"\x1b[?2026;0$y\x1b[?2027;0$y");
            }
        }
    }

    let _ = child.kill();
}
