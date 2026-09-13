use std::thread;
use std::time::{Duration, Instant};

use super::launcher;
use super::service::TerminalService;

/// Run a display-independent smoke test against the compiled native terminal
/// runtime. This is invoked before Tauri/GTK initialization by CI only.
pub fn run() -> Result<(), String> {
    let service = TerminalService::new();
    let info = service.start(
        None,
        "release-smoke-session".to_string(),
        "release-smoke-agent".to_string(),
        "sh".to_string(),
        "/tmp".to_string(),
        8,
        80,
        None,
        None,
        None,
    )?;
    let session = service
        .session_for_agent("release-smoke-agent")
        .ok_or_else(|| "release smoke session was not registered".to_string())?;

    session.input(b"printf native-terminal-smoke\r".to_vec())?;
    let deadline = Instant::now() + Duration::from_secs(2);
    let mut found = false;
    while Instant::now() < deadline {
        let snapshot = service.snapshot(&info.session_id)?;
        let text = snapshot
            .cells
            .iter()
            .flat_map(|row| row.cells.iter())
            .filter(|cell| cell.width != 0)
            .map(|cell| cell.text.as_str())
            .collect::<String>();
        if text.contains("native-terminal-smoke") {
            found = true;
            break;
        }
        thread::sleep(Duration::from_millis(20));
    }
    service.stop(&info.session_id)?;
    if !found {
        return Err("release smoke PTY did not render typed output".to_string());
    }

    if launcher::resolve(
        "orbit-provider-that-does-not-exist",
        "/tmp",
        8,
        80,
        None,
        None,
        None,
    )
    .is_ok()
    {
        return Err("release smoke strict-launch check unexpectedly succeeded".to_string());
    }

    Ok(())
}

/// Exercise the release binary's actual provider resolver and PTY/emulator
/// path for the providers installed on the host. This is deliberately opt-in:
/// AI CLIs may initialize credentials or contact a service during startup, so
/// normal CI smoke remains display-independent and side-effect-minimal.
pub fn run_provider_matrix() -> Result<(), String> {
    let providers = std::env::var("ORBIT_TERMINAL_PROVIDERS").unwrap_or_else(|_| {
        [
            "antigravity",
            "codex",
            "opencode",
            "kilocode",
            "freebuff",
            "cline",
            "copilot",
            "kiro",
            "claude",
            "goose",
            "qwen",
            "mimo",
            "muse",
            "continue",
            "aider",
            "vibe",
            "qoder",
            "shell",
        ]
        .join(",")
    });
    let strict = std::env::var_os("ORBIT_REQUIRE_PROVIDER_MATRIX").is_some();
    let timeout = std::env::var("ORBIT_PROVIDER_TIMEOUT_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(8_000);
    let mut attempted = 0;
    let mut passed = 0;
    let mut skipped = Vec::new();

    for provider in providers
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let service = TerminalService::new();
        if let Err(error) = launcher::resolve(provider, "/tmp", 24, 80, None, None, None) {
            if strict {
                return Err(format!(
                    "provider matrix could not resolve {provider}: {error}"
                ));
            }
            skipped.push(provider.to_string());
            eprintln!("[ORBIT PROVIDER MATRIX] skip provider={provider}: {error}");
            continue;
        }

        attempted += 1;
        let session_id = format!("provider-matrix-{provider}");
        let info = service.start(
            None,
            session_id,
            format!("provider-matrix-{provider}"),
            provider.to_string(),
            "/tmp".to_string(),
            24,
            80,
            None,
            None,
            None,
        )?;
        let deadline = Instant::now() + Duration::from_millis(timeout);
        let mut rendered = false;
        while Instant::now() < deadline {
            let snapshot = service.snapshot(&info.session_id)?;
            let text = snapshot_text(&snapshot);
            if snapshot.sequence > 0 && !text.trim().is_empty() {
                rendered = true;
                break;
            }
            if !service
                .session_for_agent(&format!("provider-matrix-{provider}"))
                .is_some_and(|session| session.is_running())
            {
                break;
            }
            thread::sleep(Duration::from_millis(40));
        }
        let _ = service.stop(&info.session_id);
        if !rendered {
            return Err(format!(
                "provider matrix launched {provider} but received no rendered screen output"
            ));
        }
        passed += 1;
        eprintln!("[ORBIT PROVIDER MATRIX] passed provider={provider}");
    }

    if attempted == 0 {
        return Err("provider matrix did not find any installed providers".to_string());
    }
    eprintln!(
        "[ORBIT PROVIDER MATRIX] passed={passed} attempted={attempted} skipped={}",
        skipped.join(",")
    );
    Ok(())
}

fn snapshot_text(snapshot: &super::protocol::ScreenSnapshot) -> String {
    snapshot
        .scrollback
        .iter()
        .chain(snapshot.cells.iter())
        .flat_map(|row| row.cells.iter())
        .filter(|cell| cell.width != 0)
        .map(|cell| cell.text.as_str())
        .collect::<String>()
}
