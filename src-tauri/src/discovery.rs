use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use crate::models::DetectedAgent;

static DETECTION_CACHE: Mutex<Option<(Instant, Vec<DetectedAgent>)>> = Mutex::new(None);

pub fn invalidate_detection_cache() {
    if let Ok(mut cache) = DETECTION_CACHE.lock() {
        *cache = None;
    }
}

/// Detect editor-sandboxed CLI shims that cannot run from the host.
///
/// Example: the GitHub Copilot launcher inside VS Code's globalStorage
/// (`.../github.copilot-chat/copilotCli/copilot`) is a tiny shell script that execs
/// the VS Code binary from INSIDE the editor's Flatpak/app sandbox
/// (`ELECTRON_RUN_AS_NODE=1 /app/extra/vscode/code ...`). That interpreter never
/// exists when Orbit (running on the host) spawns it, so the shim dies instantly
/// with `…: not found` and exit code 1. Scan the shim for literal absolute paths
/// that are missing on this host — any missing referenced interpreter means the
/// shim is unusable outside its sandbox.
pub fn is_unusable_sandbox_shim(path: &Path) -> bool {
    let s = path.to_string_lossy();
    // Only editor-managed shim locations (Flatpak .var/app or XDG .config/Code).
    let is_editor_shim = s.contains("copilotCli")
        && (s.contains(".var/app/") || s.contains(".config/Code") || s.contains("/Code/"));
    if !is_editor_shim {
        return false;
    }
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return true, // unreadable shim — treat as unusable
    };
    // Skip the shebang; any literal absolute path referenced afterwards that does
    // not exist on this host means the shim cannot run here.
    for line in content.lines().skip(1) {
        for token in line.split_whitespace() {
            let t = token.trim_matches(|c| c == '"' || c == '\'');
            if t.starts_with('/') && t.len() > 4 && !Path::new(t).exists() {
                return true;
            }
        }
    }
    false
}

pub fn find_executable(names: &[&str], extra_paths: &[&str]) -> Option<PathBuf> {
    // 1. Check custom extra paths first
    for path_str in extra_paths {
        let path = Path::new(path_str);
        if path.is_file() {
            return Some(path.to_path_buf());
        }
    }

    // Expand names with aliases and package variations (e.g. @kilocode/cli -> kilocode, kilo)
    let mut expanded_names: Vec<String> = Vec::new();
    for name in names {
        let trimmed = name.trim();
        if trimmed.is_empty() { continue; }
        expanded_names.push(trimmed.to_string());

        if trimmed.starts_with('@') && trimmed.contains('/') {
            let parts: Vec<&str> = trimmed.split('/').collect();
            if parts.len() == 2 {
                let org = parts[0].trim_start_matches('@');
                let pkg = parts[1];
                expanded_names.push(org.to_string());
                expanded_names.push(pkg.to_string());
                expanded_names.push(format!("{}-{}", org, pkg));
            }
        }

        let base = trimmed.trim_start_matches('@');
        let clean = base
            .trim_end_matches("-cli")
            .trim_end_matches("/cli")
            .trim_end_matches("-chat")
            .trim_end_matches("-ai");
        if clean != trimmed && !clean.is_empty() {
            expanded_names.push(clean.to_string());
        }
        if clean.contains('/') {
            let sub = clean.split('/').next_back().unwrap_or(clean);
            if !sub.is_empty() {
                expanded_names.push(sub.to_string());
            }
        }

        if trimmed.contains("kilocode") || trimmed.contains("kilo") {
            expanded_names.push("kilocode".to_string());
            expanded_names.push("kilo".to_string());
        }
        if trimmed.contains("aider") {
            expanded_names.push("aider".to_string());
        }
        if trimmed.contains("gemini") {
            expanded_names.push("gemini".to_string());
            expanded_names.push("gemini-cli".to_string());
        }
        if trimmed.contains("interpreter") {
            expanded_names.push("interpreter".to_string());
            expanded_names.push("open-interpreter".to_string());
        }
        if trimmed.contains("copilot") {
            expanded_names.push("github-copilot-cli".to_string());
            expanded_names.push("github-copilot".to_string());
            expanded_names.push("gh-copilot".to_string());
            expanded_names.push("copilot".to_string());
        }
        if trimmed.contains("goose") {
            expanded_names.push("goose".to_string());
            expanded_names.push("goose-ai".to_string());
        }
        if trimmed.contains("kiro") {
            expanded_names.push("kiro".to_string());
            expanded_names.push("kiro-cli".to_string());
        }
        if trimmed.contains("qwen") {
            expanded_names.push("qwen-code".to_string());
            expanded_names.push("qwen".to_string());
            expanded_names.push("qwen-agent".to_string());
        }
        if trimmed.contains("mimo") {
            expanded_names.push("mimo".to_string());
            expanded_names.push("mimo-cli".to_string());
            expanded_names.push("mimocode".to_string());
        }
        if trimmed.contains("muse") {
            expanded_names.push("muse".to_string());
            expanded_names.push("muse-cli".to_string());
            expanded_names.push("musecode".to_string());
        }
        if trimmed.contains("continue") {
            expanded_names.push("continue".to_string());
            expanded_names.push("cn".to_string());
            expanded_names.push("continuedev".to_string());
        }
        if trimmed.contains("freebuff") {
            expanded_names.push("freebuff".to_string());
            expanded_names.push("freebuff-ai".to_string());
            expanded_names.push("freebuff-cli".to_string());
        }
        if trimmed.contains("vibe") || trimmed.contains("mistral") {
            expanded_names.push("vibe".to_string());
            expanded_names.push("mistral-vibe".to_string());
            expanded_names.push("vibe-cli".to_string());
        }
        if trimmed.contains("qoder") {
            expanded_names.push("qodercli".to_string());
            expanded_names.push("qoder".to_string());
            expanded_names.push("qoder-cli".to_string());
            expanded_names.push("qoder_cli".to_string());
        }
    }

    // 2. Check standard user home directories
    if let Ok(home) = std::env::var("HOME") {
        let mut home_paths = vec![
            format!("{}/.local/bin", home),
            format!("{}/.cargo/bin", home),
            format!("{}/.npm-global/bin", home),
            format!("{}/.gemini/antigravity-cli/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/node_modules/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin", home),
            format!("{}/.local/share/orbit/engines/antigravity/bin", home),
            format!("{}/.local/share/orbit/engines/node_modules/.bin", home),
            format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
            format!("{}/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.local/share/pnpm/bin", home),
            format!("{}/.local/share/pnpm", home),
            format!("{}/.qoder/bin", home),
            format!("{}/.qoder/entry", home),
            format!("{}/bin", home),
        ];

        // Dynamically add all node binary directories in ~/.nvm/versions/node/*/bin
        let nvm_node_root = Path::new(&home).join(".nvm").join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(&nvm_node_root) {
            for entry in entries.flatten() {
                let bin_dir = entry.path().join("bin");
                if bin_dir.is_dir() {
                    home_paths.push(bin_dir.to_string_lossy().to_string());
                }
            }
        }

        // Dynamically add all engine binary directories in ~/.local/share/orbit/engines/*/node_modules/.bin
        let orbit_engines_root = Path::new(&home).join(".local").join("share").join("orbit").join("engines");
        if let Ok(entries) = std::fs::read_dir(&orbit_engines_root) {
            for entry in entries.flatten() {
                let bin_dir = entry.path().join("node_modules").join(".bin");
                if bin_dir.is_dir() {
                    home_paths.push(bin_dir.to_string_lossy().to_string());
                }
            }
        }

        for dir in &home_paths {
            for name in &expanded_names {
                let candidate = Path::new(dir).join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    // 3. Check system PATH and standard executable extensions (.exe, .cmd, .bat)
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for name in &expanded_names {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
                #[cfg(target_os = "windows")]
                {
                    let exe_candidate = dir.join(format!("{}.exe", name));
                    if exe_candidate.is_file() {
                        return Some(exe_candidate);
                    }
                    let cmd_candidate = dir.join(format!("{}.cmd", name));
                    if cmd_candidate.is_file() {
                        return Some(cmd_candidate);
                    }
                }
            }
        }
    }

    None
}

pub fn get_cli_version(path: &Path, _version_flag: &str) -> Option<String> {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    Some(format!("Installed ({})", name))
}

pub fn detect_all_agents() -> Vec<DetectedAgent> {
    if let Ok(cache) = DETECTION_CACHE.lock() {
        if let Some((timestamp, ref agents)) = *cache {
            if timestamp.elapsed() < Duration::from_secs(120) {
                return agents.clone();
            }
        }
    }

    let mut detected = Vec::new();

    // 1. Detect Antigravity CLI (agy)
    let agy_extra = [
        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin/agy",
        "/home/leo/.local/bin/agy",
    ];
    if let Some(agy_path) = find_executable(&["agy", "antigravity"], &agy_extra) {
        let version = get_cli_version(&agy_path, "--version")
            .map(|v| format!("v{}", v))
            .or_else(|| Some("Antigravity CLI".to_string()));

        detected.push(DetectedAgent {
            provider: "antigravity".to_string(),
            name: "ANTIGRAVITY".to_string(),
            path: agy_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Google Antigravity CLI — Deep reasoning & subagent delegation".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "antigravity".to_string(),
            name: "ANTIGRAVITY".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Google Antigravity CLI (agy not found in PATH)".to_string(),
        });
    }

    // 2. Detect Claude Code CLI (claude)
    if let Some(claude_path) = find_executable(&["claude"], &["/home/leo/.local/bin/claude"]) {
        let version = get_cli_version(&claude_path, "--version");

        detected.push(DetectedAgent {
            provider: "claude".to_string(),
            name: "CLAUDE CODE".to_string(),
            path: claude_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Anthropic Claude Code CLI — Terminal execution & tool orchestration".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "claude".to_string(),
            name: "CLAUDE CODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Anthropic Claude Code CLI (claude not found in PATH)".to_string(),
        });
    }

    // 3. Detect Codex CLI
    let codex_extra = [
        "/home/leo/.local/share/orbit/engines/codex/node_modules/.bin/codex",
        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/codex/node_modules/.bin/codex",
        "/home/leo/.local/share/orbit/engines/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex",
        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex",
        "/home/leo/.npm-global/bin/codex",
        "/home/leo/.local/bin/codex",
        "/home/leo/.cargo/bin/codex",
        "/usr/local/bin/codex",
        "/usr/bin/codex",
    ];
    if let Some(codex_path) = find_executable(&["codex", "openai-codex"], &codex_extra) {
        let version = get_cli_version(&codex_path, "--version");
        detected.push(DetectedAgent {
            provider: "codex".to_string(),
            name: "CODEX CLI".to_string(),
            path: codex_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "OpenAI Codex CLI — Algorithmic code generation & refactoring".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "codex".to_string(),
            name: "CODEX CLI".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "OpenAI Codex CLI (not installed)".to_string(),
        });
    }

    // 4. Detect OpenCode CLI
    let opencode_extra = [
        "/home/leo/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64/bin/opencode",
        "/home/leo/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin/opencode",
        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64/bin/opencode",
        "/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin/opencode",
        "/home/leo/.nvm/versions/node/v24.18.1/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode",
        "/home/leo/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode",
    ];
    if let Some(opencode_path) = find_executable(&["opencode"], &opencode_extra) {
        let version = get_cli_version(&opencode_path, "--version");
        detected.push(DetectedAgent {
            provider: "opencode".to_string(),
            name: "OPENCODE".to_string(),
            path: opencode_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "OpenCode Engine — Local terminal coding model".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "opencode".to_string(),
            name: "OPENCODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "OpenCode CLI (not installed)".to_string(),
        });
    }

    // 5. Detect KiloCode CLI
    if let Some(kilo_path) = find_executable(&["kilocode", "kilo", "@kilocode/cli"], &[]) {
        let version = get_cli_version(&kilo_path, "--version");
        detected.push(DetectedAgent {
            provider: "kilocode".to_string(),
            name: "KILOCODE".to_string(),
            path: kilo_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "KiloCode AI — Autonomous coding agent harness with codebase indexing".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "kilocode".to_string(),
            name: "KILOCODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "KiloCode CLI (not installed)".to_string(),
        });
    }

    // 6. Detect Freebuff CLI
    if let Some(freebuff_path) = find_executable(&["freebuff"], &[]) {
        let version = get_cli_version(&freebuff_path, "--version");
        detected.push(DetectedAgent {
            provider: "freebuff".to_string(),
            name: "FREEBUFF".to_string(),
            path: freebuff_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Freebuff AI — Lightweight autonomous AI coding agent harness".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "freebuff".to_string(),
            name: "FREEBUFF".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Freebuff CLI (not installed)".to_string(),
        });
    }

    // 7. Detect Cline CLI
    if let Some(cline_path) = find_executable(&["cline"], &[]) {
        let version = get_cli_version(&cline_path, "--version");
        detected.push(DetectedAgent {
            provider: "cline".to_string(),
            name: "CLINE".to_string(),
            path: cline_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Cline CLI — Autonomous multi-model terminal coding agent".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "cline".to_string(),
            name: "CLINE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Cline CLI (not installed)".to_string(),
        });
    }

    // 8. Detect GitHub Copilot CLI
    // Standalone installs first; the VS Code-internal shim is a last resort and is
    // rejected when its sandbox-internal interpreter is missing on this host.
    let copilot_extra = [
        "/home/leo/.local/share/orbit/engines/copilot/node_modules/.bin/copilot",
        "/home/leo/.npm-global/bin/copilot",
        "/home/leo/.nvm/versions/node/v24.18.1/bin/copilot",
        "/home/leo/.local/share/pnpm/copilot",
        "/home/leo/.local/bin/copilot",
        "/usr/local/bin/copilot",
        "/usr/bin/copilot",
        "/home/leo/.var/app/com.visualstudio.code/config/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot",
        "/home/leo/.config/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot",
    ];
    match find_executable(&["copilot", "github-copilot", "github-copilot-cli", "gh-copilot"], &copilot_extra) {
        Some(copilot_path) if is_unusable_sandbox_shim(&copilot_path) => {
            detected.push(DetectedAgent {
                provider: "copilot".to_string(),
                name: "GITHUB COPILOT".to_string(),
                path: copilot_path.to_string_lossy().to_string(),
                version: None,
                is_available: false,
                description: "GitHub Copilot CLI shim found only inside the VS Code sandbox — install the standalone CLI: npm install -g @github/copilot".to_string(),
            });
        }
        Some(copilot_path) => {
            let version = get_cli_version(&copilot_path, "--version");
            detected.push(DetectedAgent {
                provider: "copilot".to_string(),
                name: "GITHUB COPILOT".to_string(),
                path: copilot_path.to_string_lossy().to_string(),
                version,
                is_available: true,
                description: "Official GitHub Copilot CLI — Code generation & shell explanation harness".to_string(),
            });
        }
        None => {
            detected.push(DetectedAgent {
                provider: "copilot".to_string(),
                name: "GITHUB COPILOT".to_string(),
                path: "".to_string(),
                version: None,
                is_available: false,
                description: "GitHub Copilot CLI (not installed) — install with: npm install -g @github/copilot".to_string(),
            });
        }
    }

    // 9. Detect Goose CLI
    if let Some(goose_path) = find_executable(&["goose", "goose-ai"], &[]) {
        let version = get_cli_version(&goose_path, "--version");
        detected.push(DetectedAgent {
            provider: "goose".to_string(),
            name: "GOOSE".to_string(),
            path: goose_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Goose — Autonomous on-machine developer agent by Block".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "goose".to_string(),
            name: "GOOSE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Goose CLI (not installed)".to_string(),
        });
    }

    // 10. Detect Kiro CLI
    if let Some(kiro_path) = find_executable(&["kiro-cli", "kiro"], &[]) {
        let version = get_cli_version(&kiro_path, "--version");
        detected.push(DetectedAgent {
            provider: "kiro".to_string(),
            name: "KIRO CLI".to_string(),
            path: kiro_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Kiro CLI — High-performance autonomous terminal assistant".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "kiro".to_string(),
            name: "KIRO CLI".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Kiro CLI (not installed)".to_string(),
        });
    }

    // 11. Detect Qwen Code CLI
    if let Some(qwen_path) = find_executable(&["qwen-code", "qwen", "qwen-agent"], &[]) {
        let version = get_cli_version(&qwen_path, "--version");
        detected.push(DetectedAgent {
            provider: "qwen".to_string(),
            name: "QWEN CODE".to_string(),
            path: qwen_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Qwen Code — Specialized coding agent for deep multilingual reasoning".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "qwen".to_string(),
            name: "QWEN CODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Qwen Code CLI (not installed)".to_string(),
        });
    }

    // 12. Detect Mimo Code CLI
    if let Some(mimo_path) = find_executable(&["mimo", "mimo-cli", "mimocode"], &[]) {
        let version = get_cli_version(&mimo_path, "--version");
        detected.push(DetectedAgent {
            provider: "mimo".to_string(),
            name: "MIMO CODE".to_string(),
            path: mimo_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Mimo Code — Autonomous on-device developer coding agent CLI by Xiaomi".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "mimo".to_string(),
            name: "MIMO CODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Mimo Code CLI (not installed)".to_string(),
        });
    }

    // 13. Detect Muse Code CLI
    if let Some(muse_path) = find_executable(&["muse", "muse-cli", "musecode"], &[]) {
        let version = get_cli_version(&muse_path, "--version");
        detected.push(DetectedAgent {
            provider: "muse".to_string(),
            name: "MUSE CODE".to_string(),
            path: muse_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Muse Code — Meta AI autonomous terminal coding assistant".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "muse".to_string(),
            name: "MUSE CODE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Muse Code CLI (not installed)".to_string(),
        });
    }

    // 14. Detect Mistral Vibe CLI
    let vibe_extra = [
        "/home/leo/.var/app/com.visualstudio.code/data/uv/tools/mistral-vibe/bin/vibe",
        "/home/leo/.local/share/uv/tools/mistral-vibe/bin/vibe",
        "/home/leo/.local/bin/vibe",
        "/home/leo/.cargo/bin/vibe",
        "/home/leo/.npm-global/bin/vibe",
        "/home/leo/.nvm/versions/node/v24.18.1/bin/vibe",
        "/usr/local/bin/vibe",
        "/usr/bin/vibe",
    ];
    if let Some(vibe_path) = find_executable(&["vibe", "mistral-vibe", "vibe-cli"], &vibe_extra) {
        let version = get_cli_version(&vibe_path, "--version");
        detected.push(DetectedAgent {
            provider: "vibe".to_string(),
            name: "MISTRAL VIBE".to_string(),
            path: vibe_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Mistral Vibe — Terminal coding harness powered by Codestral".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "vibe".to_string(),
            name: "MISTRAL VIBE".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Mistral Vibe CLI (not installed)".to_string(),
        });
    }

    // 15. Detect Qoder CLI
    let qoder_extra = [
        "/home/leo/.qoder/bin/qodercli",
        "/home/leo/.qoder/bin/qoder",
        "/home/leo/.local/bin/qodercli",
        "/home/leo/.local/bin/qoder",
        "/usr/local/bin/qodercli",
        "/usr/bin/qodercli",
    ];
    if let Some(qoder_path) = find_executable(&["qodercli", "qoder", "qoder-cli", "qoder_cli"], &qoder_extra) {
        let version = get_cli_version(&qoder_path, "--version");
        detected.push(DetectedAgent {
            provider: "qoder".to_string(),
            name: "QODER CLI".to_string(),
            path: qoder_path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: "Qoder CLI — Intelligent repository navigation & refactoring".to_string(),
        });
    } else {
        detected.push(DetectedAgent {
            provider: "qoder".to_string(),
            name: "QODER CLI".to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: "Qoder CLI (not installed)".to_string(),
        });
    }

    // 16. Detect Standard Shell Terminal (Bash / Sh)
    if let Some(bash_path) = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]) {
        detected.push(DetectedAgent {
            provider: "terminal".to_string(),
            name: "SHELL TERMINAL".to_string(),
            path: bash_path.to_string_lossy().to_string(),
            version: Some("Bash Shell".to_string()),
            is_available: true,
            description: "Interactive shell terminal connected to project directory".to_string(),
        });
    }

    if let Ok(mut cache) = DETECTION_CACHE.lock() {
        *cache = Some((Instant::now(), detected.clone()));
    }

    detected
}
