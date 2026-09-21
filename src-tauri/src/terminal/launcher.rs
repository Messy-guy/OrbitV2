use std::ffi::OsString;
use std::path::{Path, PathBuf};

use portable_pty::CommandBuilder;

use crate::discovery::{find_executable, get_augmented_host_path, is_unusable_sandbox_shim};

#[derive(Debug, Clone)]
pub struct LaunchSpec {
    pub provider: String,
    pub executable: PathBuf,
    pub args: Vec<OsString>,
    pub cwd: PathBuf,
    pub env: Vec<(OsString, OsString)>,
    pub rows: u16,
    pub columns: u16,
    pub initial_prompt: Option<String>,
    pub startup_delay_ms: u64,
    pub profile_id: Option<String>,
}

impl LaunchSpec {
    pub fn command(&self) -> CommandBuilder {
        let mut command = CommandBuilder::new(&self.executable);
        command.cwd(&self.cwd);
        // A desktop-launched Tauri process does not necessarily inherit the
        // user's login-shell environment. Import the same cached login
        // environment used by the legacy runtime, then overlay the current
        // process environment while removing Orbit/multiplexer markers that
        // make interactive TUIs mis-detect their terminal.
        for (key, value) in crate::discovery::get_login_shell_environment() {
            if !is_conflicting_env(&key) {
                command.env(&key, &value);
            }
        }
        for (key, value) in std::env::vars_os() {
            if !is_conflicting_env(&key.to_string_lossy()) {
                command.env(&key, &value);
            }
        }
        for key in [
            "npm_config_prefix",
            "NPM_CONFIG_PREFIX",
            "NPM_CONFIG_GLOBALCONFIG",
            "npm_config_globalconfig",
            "ANTIGRAVITY_AGENT_ID",
            "JETSKI_AGENT_ID",
            "AI_AGENT",
            "TMUX",
            "STY",
        ] {
            command.env_remove(key);
        }
        command.env("PATH", get_augmented_host_path());
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        // Tell TUIs that the host terminal uses a light foreground on a dark
        // background. Without this hint, providers such as OpenCode can
        // choose their light theme even though Orbit renders a dark canvas.
        command.env("COLORFGBG", "15;0");
        command.env("LINES", self.rows.to_string());
        command.env("COLUMNS", self.columns.to_string());
        command.env("TERM_PROGRAM", "alacritty");
        command.env("TERM_PROGRAM_VERSION", "0.26.0");
        for (key, value) in &self.env {
            command.env(key, value);
        }
        for arg in &self.args {
            command.arg(arg);
        }
        command
    }
}

fn is_conflicting_env(key: &str) -> bool {
    key.starts_with("ANTIGRAVITY_")
        || key.starts_with("JETSKI_")
        || matches!(
            key,
            "AI_AGENT"
                | "npm_config_prefix"
                | "NPM_CONFIG_PREFIX"
                | "NPM_CONFIG_GLOBALCONFIG"
                | "npm_config_globalconfig"
        )
}

pub fn resolve(
    provider: &str,
    cwd: impl AsRef<Path>,
    rows: u16,
    columns: u16,
    role: Option<&str>,
    profile_id: Option<&str>,
    prompt: Option<String>,
    resume: Option<bool>,
) -> Result<LaunchSpec, String> {
    let provider_key = provider.trim().to_ascii_lowercase();
    let (aliases, is_shell) = match provider_key.as_str() {
        "antigravity" | "agy" => (&["agy", "antigravity"][..], false),
        "claude" => (&["claude"][..], false),
        "codex" | "openai-codex" => (&["codex", "openai-codex"][..], false),
        "opencode" | "opencode-ai" => (&["opencode", "opencode-ai"][..], false),
        "kilocode" | "kilo" | "@kilocode/cli" => {
            (&["kilocode", "kilo", "@kilocode/cli"][..], false)
        }
        "freebuff" | "freebuff-ai" | "freebuff-cli" => {
            (&["freebuff", "freebuff-ai", "freebuff-cli"][..], false)
        }
        "cline" => (&["cline"][..], false),
        "copilot" | "github-copilot" | "github-copilot-cli" | "gh-copilot" => (
            &[
                "copilot",
                "github-copilot",
                "github-copilot-cli",
                "gh-copilot",
            ][..],
            false,
        ),
        "kiro" | "kiro-cli" => (&["kiro-cli", "kiro"][..], false),
        "goose" | "goose-ai" => (&["goose", "goose-ai"][..], false),
        "qwen" | "qwen-code" | "qwen-agent" => (&["qwen-code", "qwen", "qwen-agent"][..], false),
        "mimo" | "mimo-cli" | "mimocode" => (&["mimo", "mimo-cli", "mimocode"][..], false),
        "muse" | "muse-cli" | "musecode" => (&["muse", "muse-cli", "musecode"][..], false),
        "continue" | "cn" | "continuedev" => (&["continue", "cn", "continuedev"][..], false),
        "aider" | "aider-chat" => (&["aider", "aider-chat"][..], false),
        "vibe" | "mistral-vibe" | "vibe-cli" => (&["vibe", "mistral-vibe", "vibe-cli"][..], false),
        "qoder" | "qoder-cli" | "qodercli" => {
            (&["qodercli", "qoder", "qoder-cli", "qoder_cli"][..], false)
        }
        "gemini" | "gemini-cli" => (&["gemini", "gemini-cli"][..], false),
        "terminal" | "shell" | "bash" => (&["bash", "sh"][..], true),
        "sh" => (&["sh"][..], true),
        "zsh" => (&["zsh"][..], true),
        "fish" => (&["fish"][..], true),
        custom => {
            let token = custom.split_whitespace().next().unwrap_or(custom);
            let path = find_executable(&[token], &[]).ok_or_else(|| missing_message(provider))?;
            return Ok(build_spec(
                provider,
                path,
                custom
                    .split_whitespace()
                    .skip(1)
                    .map(OsString::from)
                    .collect(),
                cwd.as_ref(),
                rows,
                columns,
                false,
                role,
                profile_id,
                prompt,
                resume.unwrap_or(false),
            ));
        }
    };

    let executable = find_executable(aliases, &[]).filter(|path| !is_unusable_sandbox_shim(path));
    let executable = executable.ok_or_else(|| missing_message(provider))?;
    eprintln!(
        "[ORBIT TERMINAL] provider={} executable={} cwd={} rows={} columns={}",
        provider,
        executable.display(),
        cwd.as_ref().display(),
        rows,
        columns
    );
    Ok(build_spec(
        provider,
        executable,
        Vec::new(),
        cwd.as_ref(),
        rows,
        columns,
        is_shell,
        role,
        profile_id,
        prompt,
        resume.unwrap_or(false),
    ))
}

fn build_spec(
    provider: &str,
    executable: PathBuf,
    mut args: Vec<OsString>,
    cwd: &Path,
    rows: u16,
    columns: u16,
    is_shell: bool,
    role: Option<&str>,
    profile_id: Option<&str>,
    initial_prompt: Option<String>,
    resume: bool,
) -> LaunchSpec {
    if is_shell {
        args.insert(0, OsString::from("-i"));
    } else if provider.eq_ignore_ascii_case("antigravity") || provider.eq_ignore_ascii_case("agy") {
        match role.unwrap_or_default() {
            "architect" | "reviewer" => {
                args.push(OsString::from("--mode"));
                args.push(OsString::from("plan"));
            }
            "implementer" | "code" => {
                args.push(OsString::from("--mode"));
                args.push(OsString::from("accept-edits"));
            }
            _ => {}
        }
        if resume && initial_prompt.is_none() {
            args.push(OsString::from("--continue"));
        }
    } else if provider.eq_ignore_ascii_case("claude") {
        if matches!(role, Some("architect" | "reviewer")) {
            args.push(OsString::from("--permission-mode"));
            args.push(OsString::from("plan"));
        }
        if resume && initial_prompt.is_none() {
            args.push(OsString::from("--continue"));
        }
    } else if provider.eq_ignore_ascii_case("opencode") || provider.eq_ignore_ascii_case("opencode-ai") {
        if resume && initial_prompt.is_none() {
            args.push(OsString::from("--continue"));
        }
    } else if matches!(
        provider.to_ascii_lowercase().as_str(),
        "vibe" | "mistral-vibe" | "vibe-cli"
    ) {
        args.push(OsString::from("--trust"));
    }

    let startup_delay_ms = match provider.to_ascii_lowercase().as_str() {
        "opencode" | "opencode-ai" => 2200,
        "mimo" | "mimo-cli" | "mimocode" => 5000,
        "vibe" | "mistral-vibe" | "vibe-cli" => 1800,
        "antigravity" | "agy" => if initial_prompt.is_some() { 1200 } else { 0 },
        "claude" => if initial_prompt.is_some() { 1000 } else { 0 },
        "codex" | "openai-codex" => if initial_prompt.is_some() { 1000 } else { 0 },
        "terminal" | "shell" | "bash" | "sh" | "zsh" | "fish" => 0,
        // Providers without a documented startup handshake must receive
        // input immediately. A generic sleep is indistinguishable from a
        // frozen terminal and was one of the production failure modes.
        _ => 0,
    };
    let mut env = profile_environment(profile_id);
    if matches!(
        provider.to_ascii_lowercase().as_str(),
        "vibe" | "mistral-vibe" | "vibe-cli"
    ) {
        if let Some(home) = std::env::var_os("HOME") {
            let vibe_home = std::path::PathBuf::from(home).join(".vibe");
            env.push((OsString::from("VIBE_HOME"), vibe_home.into_os_string()));
        }
        env.push((OsString::from("PYTHONUNBUFFERED"), OsString::from("1")));
        env.push((OsString::from("PYTHONIOENCODING"), OsString::from("utf-8")));
    }
    LaunchSpec {
        provider: provider.to_string(),
        executable,
        args,
        cwd: cwd.to_path_buf(),
        env,
        rows: rows.max(1),
        columns: columns.max(1),
        initial_prompt,
        startup_delay_ms,
        profile_id: profile_id
            .map(str::trim)
            .filter(|profile| !profile.is_empty())
            .map(str::to_string),
    }
}

fn profile_environment(profile_id: Option<&str>) -> Vec<(OsString, OsString)> {
    let Some(profile) = profile_id
        .map(str::trim)
        .filter(|profile| !profile.is_empty() && !profile.eq_ignore_ascii_case("default"))
    else {
        return Vec::new();
    };

    let user_home = std::env::var_os("HOME").unwrap_or_else(|| OsString::from("/tmp"));
    let profile_root = PathBuf::from(user_home)
        .join(".orbit")
        .join("profiles")
        .join(profile);
    let gemini_dir = profile_root.join(".gemini");
    let config_dir = profile_root.join(".config");
    let data_dir = profile_root.join(".local").join("share");
    for directory in [&profile_root, &gemini_dir, &config_dir, &data_dir] {
        let _ = std::fs::create_dir_all(directory);
    }

    vec![
        (
            OsString::from("HOME"),
            profile_root.clone().into_os_string(),
        ),
        (
            OsString::from("XDG_CONFIG_HOME"),
            config_dir.into_os_string(),
        ),
        (OsString::from("XDG_DATA_HOME"), data_dir.into_os_string()),
        (
            OsString::from("ANTIGRAVITY_CONFIG_DIR"),
            gemini_dir.clone().into_os_string(),
        ),
        (
            OsString::from("JETSKI_APP_DATA_DIR"),
            gemini_dir.join("antigravity-cli").into_os_string(),
        ),
        (OsString::from("ORBIT_PROFILE_ID"), OsString::from(profile)),
        (
            OsString::from("DBUS_SESSION_BUS_ADDRESS"),
            OsString::from("disabled:"),
        ),
        (OsString::from("GNOME_KEYRING_CONTROL"), OsString::new()),
        (
            OsString::from("PYTHON_KEYRING_BACKEND"),
            OsString::from("keyring.backends.null.Keyring"),
        ),
    ]
}

fn missing_message(provider: &str) -> String {
    format!(
        "The configured provider '{provider}' could not be launched. No matching executable was found in PATH. Resolved PATH: {}",
        get_augmented_host_path()
    )
}

#[cfg(test)]
mod tests {
    use super::resolve;

    #[test]
    fn shell_is_explicit_and_interactive() {
        let spec = resolve("bash", "/tmp", 24, 80, None, None, None, None).unwrap();
        assert_eq!(spec.args, vec!["-i"]);
    }

    #[test]
    fn built_in_terminal_provider_resolves_to_an_interactive_shell() {
        let spec = resolve("terminal", "/tmp", 24, 80, None, None, None, None).unwrap();
        assert_eq!(spec.args, vec!["-i"]);
        // Windows shell executables include the `.exe` suffix (for example
        // `bash.exe`), while Unix paths do not. Compare the executable's
        // stem so the invariant is platform-independent.
        let executable_stem = spec
            .executable
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default();
        assert!(matches!(executable_stem, "bash" | "sh"));
    }

    #[test]
    fn unknown_provider_does_not_fall_back_to_shell() {
        let error = resolve(
            "orbit-provider-that-does-not-exist",
            "/tmp",
            24,
            80,
            None,
            None,
            None,
            None,
        )
        .expect_err("missing provider must fail");
        assert!(error.contains("could not be launched"));
    }

    #[test]
    fn custom_profile_gets_isolated_paths() {
        let spec = resolve("bash", "/tmp", 24, 80, None, Some("work"), None, None).unwrap();
        let keys = spec
            .env
            .iter()
            .map(|(key, _)| key.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(keys.iter().any(|key| key == "HOME"));
        assert!(keys.iter().any(|key| key == "XDG_CONFIG_HOME"));
        assert!(keys.iter().any(|key| key == "ORBIT_PROFILE_ID"));
    }

    #[test]
    fn resume_flag_appends_continue_for_supported_providers() {
        if let Ok(spec) = resolve("agy", "/tmp", 24, 80, None, None, None, Some(true)) {
            assert!(spec.args.iter().any(|arg| arg == "--continue" || arg == "-c"));
        }
    }
}
