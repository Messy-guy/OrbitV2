use std::path::{Path, PathBuf};
use std::process::Command;
use crate::models::DetectedAgent;

pub fn find_executable(names: &[&str], extra_paths: &[&str]) -> Option<PathBuf> {
    // 1. Check custom extra paths first
    for path_str in extra_paths {
        let path = Path::new(path_str);
        if path.is_file() {
            return Some(path.to_path_buf());
        }
    }

    // 2. Check standard user home directories
    if let Ok(home) = std::env::var("HOME") {
        let home_paths = [
            format!("{}/.local/bin", home),
            format!("{}/.cargo/bin", home),
            format!("{}/.npm-global/bin", home),
            format!("{}/.gemini/antigravity-cli/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin", home),
            format!("{}/.local/share/orbit/engines/antigravity/bin", home),
            format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
            format!("{}/.nvm/versions/node/v24.18.1/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin", home),
            format!("{}/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin", home),
            format!("{}/bin", home),
        ];

        for dir in &home_paths {
            for name in names {
                let candidate = Path::new(dir).join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    // 3. Check system PATH via 'which' or direct check
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for name in names {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    // 4. Try running 'which'
    for name in names {
        if let Ok(output) = Command::new("which").arg(name).output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() && Path::new(&path_str).is_file() {
                    return Some(PathBuf::from(path_str));
                }
            }
        }
    }

    None
}

pub fn get_cli_version(path: &Path, version_flag: &str) -> Option<String> {
    if let Ok(output) = Command::new(path).arg(version_flag).output() {
        if output.status.success() || !output.stdout.is_empty() {
            let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let first_line = out_str.lines().next().unwrap_or("").trim().to_string();
            if !first_line.is_empty() {
                return Some(first_line);
            }
        }
    }
    None
}

pub fn detect_all_agents() -> Vec<DetectedAgent> {
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
    if let Some(codex_path) = find_executable(&["codex", "openai-codex"], &[]) {
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

    // 5. Detect Standard Shell Terminal (Bash / Sh)
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

    detected
}
