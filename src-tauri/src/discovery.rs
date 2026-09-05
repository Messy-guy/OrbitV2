use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use crate::models::DetectedAgent;

static DETECTION_CACHE: Mutex<Option<(Instant, Vec<DetectedAgent>)>> = Mutex::new(None);

pub fn invalidate_detection_cache() {
    if let Ok(mut cache) = DETECTION_CACHE.lock() {
        *cache = None;
    }
}

pub fn is_unusable_sandbox_shim(path: &Path) -> bool {
    let s = path.to_string_lossy();
    let is_editor_shim = s.contains("copilotCli")
        && (s.contains(".var/app/") || s.contains(".config/Code") || s.contains("/Code/"));
    if !is_editor_shim {
        return false;
    }
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return true,
    };
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

static LOGIN_SHELL_PATH: Mutex<Option<String>> = Mutex::new(None);

/// Dynamically probe the user's login shell PATH (e.g. bash -l / zsh -l).
/// This ensures GUI desktop launches get 100% of the user's terminal environment (NVM, pyenv, cargo, brew, etc.).
pub fn get_login_shell_path() -> Option<String> {
    if let Ok(guard) = LOGIN_SHELL_PATH.lock() {
        if let Some(ref p) = *guard {
            return Some(p.clone());
        }
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| {
        #[cfg(not(target_os = "windows"))]
        { "/bin/bash".to_string() }
        #[cfg(target_os = "windows")]
        { "cmd.exe".to_string() }
    });

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new(&shell)
        .args(["-l", "-c", "source ~/.bashrc 2>/dev/null || true; source ~/.zshrc 2>/dev/null || true; source ~/.profile 2>/dev/null || true; source ~/.nvm/nvm.sh 2>/dev/null || true; printf '%s' \"$PATH\""])
        .output();

    #[cfg(target_os = "windows")]
    let output = std::process::Command::new(&shell)
        .args(["/c", "echo %PATH%"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                if let Ok(mut guard) = LOGIN_SHELL_PATH.lock() {
                    *guard = Some(s.clone());
                }
                return Some(s);
            }
        }
    }
    None
}

/// Build the canonical list of directories to search for host binaries.
/// All paths are derived dynamically from $HOME — no hardcoded usernames.
pub fn get_host_search_dirs() -> Vec<String> {
    let home = match std::env::var("HOME") {
        Ok(h) if !h.is_empty() => h,
        _ => return vec![
            "/usr/local/bin".to_string(),
            "/usr/bin".to_string(),
            "/bin".to_string(),
            "/usr/sbin".to_string(),
            "/sbin".to_string(),
        ],
    };

    let mut dirs: Vec<String> = Vec::new();

    // 1. All NVM node versions newest-first (HIGHEST PRIORITY: node, npm, and global agent CLIs)
    let nvm_node_root = Path::new(&home).join(".nvm").join("versions").join("node");
    if let Ok(entries) = std::fs::read_dir(&nvm_node_root) {
        let mut nvm_bins: Vec<String> = entries
            .flatten()
            .map(|e| e.path().join("bin").to_string_lossy().to_string())
            .filter(|p| Path::new(p).is_dir())
            .collect();
        nvm_bins.sort_unstable_by(|a, b| b.cmp(a));
        dirs.extend(nvm_bins);
    }

    // 2. User binary & package manager directories
    dirs.extend(vec![
        format!("{}/.local/bin", home),
        format!("{}/.cargo/bin", home),
        format!("{}/.npm-global/bin", home),
        format!("{}/.npm-global/lib/node_modules/.bin", home),
        format!("{}/.gemini/antigravity-cli/bin", home),
        format!("{}/.local/share/pnpm/bin", home),
        format!("{}/.local/share/pnpm", home),
        format!("{}/.bun/bin", home),
        format!("{}/.deno/bin", home),
        format!("{}/.yarn/bin", home),
        format!("{}/.fnm/current/bin", home),
        format!("{}/.asdf/shims", home),
        format!("{}/.asdf/bin", home),
        format!("{}/.volta/bin", home),
        format!("{}/.qoder/entry", home),
        format!("{}/.qoder/bin", home),
        format!("{}/.kimi-code/bin", home),
        format!("{}/bin", home),
        format!("{}/.var/app/com.visualstudio.code/data/node_modules/bin", home),
        format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin", home),
        format!("{}/.local/share/orbit/engines/antigravity/bin", home),
        format!("{}/.local/share/orbit/engines/node_modules/.bin", home),
        format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
        format!("{}/.local/share/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
        format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64/bin", home),
        format!("{}/.var/app/com.visualstudio.code/data/orbit/engines/opencode/node_modules/opencode-linux-x64-baseline/bin", home),
        format!("{}/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin", home),
        format!("{}/.local/share/uv/tools/mistral-vibe/bin", home),
        format!("{}/.var/app/com.visualstudio.code/data/uv/tools/mistral-vibe/bin", home),
    ]);

    // 3. Local Orbit engine node_modules/.bin
    let orbit_engines_local = Path::new(&home).join(".local").join("share").join("orbit").join("engines");
    if let Ok(entries) = std::fs::read_dir(&orbit_engines_local) {
        for entry in entries.flatten() {
            let bin_dir = entry.path().join("node_modules").join(".bin");
            if bin_dir.is_dir() {
                dirs.push(bin_dir.to_string_lossy().to_string());
            }
        }
    }

    // 4. VS Code Flatpak orbit engine node_modules/.bin
    let vscode_orbit_engines = Path::new(&home).join(".var/app/com.visualstudio.code/data/orbit/engines");
    if let Ok(entries) = std::fs::read_dir(&vscode_orbit_engines) {
        for entry in entries.flatten() {
            let bin_dir = entry.path().join("node_modules").join(".bin");
            if bin_dir.is_dir() {
                dirs.push(bin_dir.to_string_lossy().to_string());
            }
        }
    }

    // 5. System directories
    dirs.extend(vec![
        "/home/linuxbrew/.linuxbrew/bin".to_string(),
        "/snap/bin".to_string(),
        "/usr/local/bin".to_string(),
        "/usr/bin".to_string(),
        "/bin".to_string(),
        "/usr/sbin".to_string(),
        "/sbin".to_string(),
    ]);

    dirs
}

/// Returns an augmented PATH string that includes all user tool directories so
/// that node-based CLIs with #!/usr/bin/env node shebangs work correctly when
/// the app is launched from the GUI (which only gets a minimal system PATH).
pub fn get_augmented_host_path() -> String {
    let mut seen = std::collections::HashSet::new();
    let mut parts: Vec<String> = Vec::new();

    // 1. Dynamic login shell PATH (highest priority — mirrors terminal environment)
    if let Some(login_path) = get_login_shell_path() {
        for seg in login_path.split(':') {
            let trimmed = seg.trim().trim_matches(|c| c == '\\' || c == '"' || c == '\'');
            if !trimmed.is_empty() && Path::new(trimmed).is_dir() && seen.insert(trimmed.to_string()) {
                parts.push(trimmed.to_string());
            }
        }
    }

    // 2. Comprehensive search directories
    for d in get_host_search_dirs() {
        if !d.is_empty() && Path::new(&d).is_dir() && seen.insert(d.clone()) {
            parts.push(d);
        }
    }

    // 3. Current process PATH
    let current_path = std::env::var("PATH").unwrap_or_default();
    for seg in current_path.split(':') {
        if !seg.is_empty() && seen.insert(seg.to_string()) {
            parts.push(seg.to_string());
        }
    }

    parts.join(":")
}

pub fn find_executable(names: &[&str], extra_paths: &[&str]) -> Option<PathBuf> {
    // 1. Check custom extra paths first
    for path_str in extra_paths {
        let path = Path::new(path_str);
        if path.is_file() {
            return Some(path.to_path_buf());
        }
    }

    // Expand names with aliases and package variations
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
        if trimmed.contains("aider") { expanded_names.push("aider".to_string()); }
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

    // 2. Check dynamic host search dirs (HOME-relative, NVM, Orbit engines, etc.)
    for dir in get_host_search_dirs() {
        for name in &expanded_names {
            let candidate = Path::new(&dir).join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // 3. Check system PATH
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
                    if exe_candidate.is_file() { return Some(exe_candidate); }
                    let cmd_candidate = dir.join(format!("{}.cmd", name));
                    if cmd_candidate.is_file() { return Some(cmd_candidate); }
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

pub fn get_engine_state_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        Path::new(&home).join(".local").join("share").join("orbit").join("engine-state.json")
    } else {
        PathBuf::from("/tmp/orbit-engine-state.json")
    }
}

pub fn is_provider_orbit_managed(provider: &str) -> bool {
    let path = get_engine_state_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(managed_arr) = json.get("orbit_managed").and_then(|v| v.as_array()) {
                let target = provider.to_lowercase();
                return managed_arr.iter().any(|v| v.as_str().map(|s| s.to_lowercase()) == Some(target.clone()));
            }
        }
    }
    false
}

pub fn set_provider_orbit_managed(provider: &str, managed: bool) {
    let path = get_engine_state_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut state_json: serde_json::Value = if let Ok(content) = std::fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let mut list: Vec<String> = state_json
        .get("orbit_managed")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let prov = provider.to_lowercase();
    if managed {
        if !list.contains(&prov) {
            list.push(prov);
        }
    } else {
        list.retain(|p| p != &prov);
    }

    state_json["orbit_managed"] = serde_json::json!(list);
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&state_json).unwrap_or_default());
}

fn make_detected_agent(
    provider: &str,
    name: &str,
    path_opt: Option<PathBuf>,
    default_version: Option<&str>,
    desc_ready: &str,
    desc_missing: &str,
) -> DetectedAgent {
    let is_managed = is_provider_orbit_managed(provider);
    if provider == "terminal" || provider == "shell" {
        let p = path_opt.unwrap_or_else(|| PathBuf::from("/bin/bash"));
        return DetectedAgent {
            provider: provider.to_string(),
            name: name.to_string(),
            path: p.to_string_lossy().to_string(),
            version: default_version.map(|v| v.to_string()),
            is_available: true,
            description: desc_ready.to_string(),
            installation_source: Some("system".to_string()),
            installed_by_orbit: Some(false),
        };
    }

    if let Some(path) = path_opt {
        let version = get_cli_version(&path, "--version")
            .or_else(|| default_version.map(|v| v.to_string()));
        let is_orbit_path = path.to_string_lossy().contains(".local/share/orbit/engines")
            || path.to_string_lossy().contains("orbit/engines");
        let is_orbit_managed = is_managed || is_orbit_path;
        DetectedAgent {
            provider: provider.to_string(),
            name: name.to_string(),
            path: path.to_string_lossy().to_string(),
            version,
            is_available: true,
            description: desc_ready.to_string(),
            installation_source: Some(if is_orbit_managed { "orbit".to_string() } else { "external".to_string() }),
            installed_by_orbit: Some(is_orbit_managed),
        }
    } else {
        DetectedAgent {
            provider: provider.to_string(),
            name: name.to_string(),
            path: "".to_string(),
            version: None,
            is_available: false,
            description: desc_missing.to_string(),
            installation_source: None,
            installed_by_orbit: Some(false),
        }
    }
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

    // 1. Antigravity CLI (agy)
    let agy_path = find_executable(&["agy", "antigravity"], &[]);
    detected.push(make_detected_agent(
        "antigravity",
        "ANTIGRAVITY",
        agy_path,
        Some("Antigravity CLI"),
        "Google Antigravity CLI — Deep reasoning & subagent delegation",
        "Google Antigravity CLI (not installed) — install with 1-click installer",
    ));

    // 2. Claude Code CLI
    let claude_path = find_executable(&["claude"], &[]);
    detected.push(make_detected_agent(
        "claude",
        "CLAUDE CODE",
        claude_path,
        Some("Claude Code"),
        "Anthropic Claude Code CLI — Terminal execution & tool orchestration",
        "Anthropic Claude Code CLI (not installed) — install with: npm install -g @anthropic-ai/claude-code",
    ));

    // 3. Codex CLI
    let codex_path = find_executable(&["codex", "openai-codex"], &[]);
    detected.push(make_detected_agent(
        "codex",
        "CODEX CLI",
        codex_path,
        Some("Codex CLI"),
        "OpenAI Codex CLI — Algorithmic code generation & refactoring",
        "OpenAI Codex CLI (not installed) — install with: npm install -g @openai/codex",
    ));

    // 4. OpenCode CLI
    let opencode_path = find_executable(&["opencode"], &[]);
    detected.push(make_detected_agent(
        "opencode",
        "OPENCODE",
        opencode_path,
        Some("OpenCode Engine"),
        "OpenCode Engine — Local terminal coding model",
        "OpenCode CLI (not installed) — install with: npm install -g opencode-ai",
    ));

    // 5. KiloCode CLI
    let kilo_path = find_executable(&["kilocode", "kilo", "@kilocode/cli"], &[]);
    detected.push(make_detected_agent(
        "kilocode",
        "KILOCODE",
        kilo_path,
        Some("KiloCode AI"),
        "KiloCode AI — Autonomous coding agent harness with codebase indexing",
        "KiloCode CLI (not installed) — install with: npm install -g @kilocode/cli",
    ));

    // 6. Freebuff CLI
    let freebuff_path = find_executable(&["freebuff", "freebuff-ai", "freebuff-cli"], &[]);
    detected.push(make_detected_agent(
        "freebuff",
        "FREEBUFF",
        freebuff_path,
        Some("Freebuff AI"),
        "Freebuff AI — Lightweight autonomous AI coding agent harness",
        "Freebuff CLI (not installed) — install with: npm install -g freebuff",
    ));

    // 7. Cline CLI
    let cline_path = find_executable(&["cline"], &[]);
    detected.push(make_detected_agent(
        "cline",
        "CLINE",
        cline_path,
        Some("Cline CLI"),
        "Cline CLI — Autonomous multi-model terminal coding agent",
        "Cline CLI (not installed) — install with: npm install -g cline",
    ));

    // 8. GitHub Copilot CLI
    let copilot_path = match find_executable(&["copilot", "github-copilot", "github-copilot-cli", "gh-copilot"], &[]) {
        Some(p) if is_unusable_sandbox_shim(&p) => None,
        Some(p) => Some(p),
        None => None,
    };
    detected.push(make_detected_agent(
        "copilot",
        "GITHUB COPILOT",
        copilot_path,
        Some("Copilot CLI"),
        "Official GitHub Copilot CLI — Code generation & shell explanation harness",
        "GitHub Copilot CLI (not installed) — install with: npm install -g @github/copilot",
    ));

    // 9. Goose CLI
    let goose_path = find_executable(&["goose", "goose-ai"], &[]);
    detected.push(make_detected_agent(
        "goose",
        "GOOSE",
        goose_path,
        Some("Goose AI"),
        "Goose — Autonomous on-machine developer agent by Block",
        "Goose CLI (not installed) — install with 1-click installer",
    ));

    // 10. Kiro CLI
    let kiro_path = find_executable(&["kiro-cli", "kiro"], &[]);
    detected.push(make_detected_agent(
        "kiro",
        "KIRO CLI",
        kiro_path,
        Some("Kiro CLI"),
        "Kiro CLI — High-performance autonomous terminal assistant",
        "Kiro CLI (not installed) — install with: npm install -g kiro-cli",
    ));

    // 11. Qwen Code CLI
    let qwen_path = find_executable(&["qwen-code", "qwen", "qwen-agent"], &[]);
    detected.push(make_detected_agent(
        "qwen",
        "QWEN CODE",
        qwen_path,
        Some("Qwen Code"),
        "Qwen Code — Specialized coding agent for deep multilingual reasoning",
        "Qwen Code CLI (not installed) — install with: npm install -g @qwen-code/qwen-code",
    ));

    // 12. Mimo Code CLI
    let mimo_path = find_executable(&["mimo", "mimo-cli", "mimocode"], &[]);
    detected.push(make_detected_agent(
        "mimo",
        "MIMO CODE",
        mimo_path,
        Some("Mimo Code"),
        "Mimo Code — Autonomous on-device developer coding agent CLI by Xiaomi",
        "Mimo Code CLI (not installed) — install with: npm install -g @mimo-ai/cli",
    ));

    // 13. Muse Code CLI
    let muse_path = find_executable(&["muse", "muse-cli", "musecode"], &[]);
    detected.push(make_detected_agent(
        "muse",
        "MUSE CODE",
        muse_path,
        Some("Muse Code"),
        "Muse Code — Meta AI autonomous terminal coding assistant",
        "Muse Code CLI (not installed) — install with 1-click installer",
    ));

    // 14. Mistral Vibe CLI
    let vibe_path = find_executable(&["vibe", "mistral-vibe", "vibe-cli"], &[]);
    detected.push(make_detected_agent(
        "vibe",
        "MISTRAL VIBE",
        vibe_path,
        Some("Mistral Vibe"),
        "Mistral Vibe — Terminal coding harness powered by Codestral",
        "Mistral Vibe CLI (not installed) — install with: curl -LsSf https://mistral.ai/vibe/install.sh | bash",
    ));

    // 15. Qoder CLI
    let qoder_path = find_executable(&["qodercli", "qoder", "qoder-cli", "qoder_cli"], &[]);
    detected.push(make_detected_agent(
        "qoder",
        "QODER CLI",
        qoder_path,
        Some("Qoder CLI"),
        "Qoder CLI — Intelligent repository navigation & refactoring",
        "Qoder CLI (not installed) — install with: curl -fsSL https://qoder.com/install | bash",
    ));

    // 16. Standard Shell Terminal (Bash / Sh)
    let bash_path = find_executable(&["bash", "sh"], &["/bin/bash", "/usr/bin/bash"]);
    detected.push(make_detected_agent(
        "terminal",
        "SHELL TERMINAL",
        bash_path,
        Some("Bash Shell"),
        "Interactive shell terminal connected to project directory",
        "System shell terminal",
    ));

    if let Ok(mut cache) = DETECTION_CACHE.lock() {
        *cache = Some((Instant::now(), detected.clone()));
    }

    detected
}
