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
}

const DEFAULT_SPEC: ProviderRuntimeSpec = ProviderRuntimeSpec {
    direct_cli: false,
    startup_delay_ms: 800,
};

const TUI_SPEC: ProviderRuntimeSpec = ProviderRuntimeSpec {
    direct_cli: true,
    startup_delay_ms: 2000,
};

pub fn runtime_spec(provider: &str) -> ProviderRuntimeSpec {
    match provider.to_lowercase().as_str() {
        "terminal" | "shell" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 0,
        },
        "opencode" | "opencode-ai" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 2200,
        },
        "antigravity" | "agy" | "claude" | "codex" | "openai-codex" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 800,
        },
        "mimo" | "mimo-cli" | "mimocode" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 5000,
        },
        "vibe" | "mistral-vibe" | "vibe-cli" => ProviderRuntimeSpec {
            direct_cli: true,
            startup_delay_ms: 1800,
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
    }
}
