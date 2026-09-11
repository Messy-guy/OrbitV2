//! Provider-neutral runtime metadata.
//!
//! Launch command resolution remains in `PtyManager`, but terminal behavior
//! belongs here so lifecycle/input decisions do not get duplicated across the
//! PTY implementation. This module intentionally has no remote-control or
//! frontend dependencies.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderRuntimeSpec {
    pub direct_cli: bool,
    pub startup_delay_ms: u64,
    pub clear_multiplexer_env: bool,
    pub term_program: Option<&'static str>,
}

const DEFAULT_SPEC: ProviderRuntimeSpec = ProviderRuntimeSpec {
    direct_cli: false,
    startup_delay_ms: 800,
    clear_multiplexer_env: false,
    term_program: None,
};

const TUI_SPEC: ProviderRuntimeSpec = ProviderRuntimeSpec {
    direct_cli: true,
    startup_delay_ms: 2000,
    clear_multiplexer_env: true,
    term_program: Some("xterm.js"),
};

pub fn runtime_spec(provider: &str) -> ProviderRuntimeSpec {
    match provider.to_lowercase().as_str() {
        "terminal" | "shell" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 0,
            clear_multiplexer_env: true,
            term_program: Some("xterm.js"),
        },
        "opencode" | "opencode-ai" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 2200,
            clear_multiplexer_env: true,
            term_program: Some("xterm.js"),
        },
        "antigravity" | "agy" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 800,
            clear_multiplexer_env: true,
            term_program: Some("alacritty"),
        },
        "claude" | "codex" | "openai-codex" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 800,
            clear_multiplexer_env: true,
            term_program: Some("xterm.js"),
        },
        "mimo" | "mimo-cli" | "mimocode" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 5000,
            clear_multiplexer_env: true,
            term_program: Some("xterm.js"),
        },
        "vibe" | "mistral-vibe" | "vibe-cli" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 1800,
            clear_multiplexer_env: true,
            term_program: Some("xterm.js"),
        },
        "kilocode" | "kilo" | "@kilocode/cli" | "freebuff" | "freebuff-ai"
        | "freebuff-cli" | "cline" | "copilot" | "github-copilot"
        | "github-copilot-cli" | "gh-copilot" | "goose" | "goose-ai" | "kiro"
        | "kiro-cli" | "qwen" | "qwen-code" | "qwen-agent" | "muse" | "muse-cli"
        | "musecode" | "qoder" | "qoder-cli" | "qodercli" => TUI_SPEC,
        _ => DEFAULT_SPEC,
    }
}

#[cfg(test)]
mod tests {
    use super::runtime_spec;

    #[test]
    fn tui_providers_are_direct_cli_sessions() {
        for provider in ["antigravity", "opencode", "kiro", "goose"] {
            assert!(runtime_spec(provider).direct_cli);
        }
    }

    #[test]
    fn shell_has_no_startup_delay() {
        let spec = runtime_spec("shell");
        assert!(spec.direct_cli);
        assert_eq!(spec.startup_delay_ms, 0);
        assert!(spec.clear_multiplexer_env);
    }
}
