use crate::models::{ChangedFileItem, ContextPackage, GitState};

pub fn redact_secrets(input: &str) -> String {
    let mut result = input.to_string();

    let secret_patterns = [
        ("(?i)(api[_-]?key|apikey)\\s*[:=]\\s*['\"]?([a-zA-Z0-9_\\-]{8,})['\"]?", "[REDACTED_API_KEY]"),
        ("(?i)(secret[_-]?key|secret)\\s*[:=]\\s*['\"]?([a-zA-Z0-9_\\-]{8,})['\"]?", "[REDACTED_SECRET]"),
        ("(?i)(token|auth[_-]?token|bearer)\\s*[:=]\\s*['\"]?([a-zA-Z0-9_\\-]{8,})['\"]?", "[REDACTED_TOKEN]"),
        ("(?i)(password|passwd|pwd)\\s*[:=]\\s*['\"]?([^\\s'\"]{4,})['\"]?", "[REDACTED_PASSWORD]"),
    ];

    for (pattern, replacement) in &secret_patterns {
        if let Ok(re) = regex_simple_replace(&result, pattern, replacement) {
            result = re;
        }
    }

    result
}

// Simple deterministic replacement for common token assignments without full regex crate overhead
fn regex_simple_replace(text: &str, _pattern: &str, _replacement: &str) -> Result<String, ()> {
    let mut out = String::new();
    for line in text.lines() {
        let lower = line.to_lowercase();
        if lower.contains("api_key=") || lower.contains("apikey=") || lower.contains("secret=") || lower.contains("token=") || lower.contains("password=") {
            if let Some(eq_pos) = line.find('=') {
                out.push_str(&line[..=eq_pos]);
                out.push_str("[REDACTED]\n");
                continue;
            }
        }
        out.push_str(line);
        out.push('\n');
    }
    if out.ends_with('\n') && !text.ends_with('\n') {
        out.pop();
    }
    Ok(out)
}

pub fn estimate_tokens(text: &str) -> usize {
    // Standard rule of thumb: ~4 characters per token
    let chars = text.chars().count();
    if chars == 0 { 0 } else { (chars / 4).max(1) }
}

pub fn format_context_instruction(
    workspace_name: &str,
    source_agent: &str,
    current_task: &str,
    progress: &str,
    decisions: &[String],
    changed_files: &[ChangedFileItem],
    known_issues: &[String],
    git_state: Option<&GitState>,
    relevant_history: Option<&[String]>,
) -> String {
    let mut prompt = String::new();

    prompt.push_str("============================================================\n");
    prompt.push_str("ORBIT CONTEXT HANDOFF\n");
    prompt.push_str("============================================================\n\n");
    prompt.push_str(&format!("You are continuing work on project: {}\n", workspace_name));
    prompt.push_str(&format!("Previous agent context transferred from: {}\n\n", source_agent));

    prompt.push_str("--- CURRENT TASK ---\n");
    prompt.push_str(current_task);
    prompt.push_str("\n\n");

    prompt.push_str("--- PROGRESS SO FAR ---\n");
    prompt.push_str(progress);
    prompt.push_str("\n\n");

    if !decisions.is_empty() {
        prompt.push_str("--- ARCHITECTURAL DECISIONS ---\n");
        for d in decisions {
            prompt.push_str(&format!("• {}\n", d));
        }
        prompt.push('\n');
    }

    if !changed_files.is_empty() {
        prompt.push_str("--- RELEVANT / CHANGED FILES ---\n");
        for f in changed_files {
            prompt.push_str(&format!("• {} ({})\n", f.path, f.status));
        }
        prompt.push('\n');
    }

    if !known_issues.is_empty() {
        prompt.push_str("--- KNOWN ISSUES & BLOCKERS ---\n");
        for issue in known_issues {
            prompt.push_str(&format!("• {}\n", issue));
        }
        prompt.push('\n');
    }

    if let Some(git) = git_state {
        prompt.push_str("--- GIT STATE ---\n");
        prompt.push_str(&format!("Branch: {}\n", git.current_branch));
        prompt.push_str(&format!("HEAD: {}\n", git.head_commit));
        if !git.recent_commits.is_empty() {
            prompt.push_str("Recent commits:\n");
            for c in &git.recent_commits {
                prompt.push_str(&format!("  - {}\n", c));
            }
        }
        prompt.push('\n');
    }

    if let Some(history) = relevant_history {
        if !history.is_empty() {
            prompt.push_str("--- RELEVANT SESSION HISTORY ---\n");
            for h in history {
                prompt.push_str(&format!("> {}\n", h));
            }
            prompt.push('\n');
        }
    }

    prompt.push_str("============================================================\n");
    prompt.push_str("INSTRUCTIONS:\n");
    prompt.push_str("1. Continue from this exact state.\n");
    prompt.push_str("2. Do not redo completed work.\n");
    prompt.push_str("3. Inspect the listed files and Git state before making changes.\n");
    prompt.push_str("============================================================\n");

    redact_secrets(&prompt)
}

pub fn build_context_package(
    source_agent: String,
    source_session_id: String,
    target_agent: String,
    workspace_id: String,
    workspace_name: String,
    project_path: String,
    checkpoint_id: Option<String>,
    current_task: String,
    progress: String,
    decisions: Vec<String>,
    changed_files: Vec<ChangedFileItem>,
    known_issues: Vec<String>,
    git_state: Option<GitState>,
    relevant_history: Option<Vec<String>>,
    notes: Option<Vec<String>>,
) -> ContextPackage {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let instruction = format_context_instruction(
        &workspace_name,
        &source_agent,
        &current_task,
        &progress,
        &decisions,
        &changed_files,
        &known_issues,
        git_state.as_ref(),
        relevant_history.as_deref(),
    );

    let estimated_tokens = estimate_tokens(&instruction);

    ContextPackage {
        schema_version: 1,
        source_agent,
        source_session_id,
        target_agent,
        workspace_id,
        workspace_name,
        project_path,
        checkpoint_id,
        current_task,
        progress,
        decisions,
        changed_files,
        known_issues,
        git_state,
        relevant_history,
        notes,
        generated_at: now,
        estimated_tokens,
        formatted_instruction: Some(instruction),
    }
}
