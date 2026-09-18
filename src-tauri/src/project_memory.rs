use crate::project_scanner::{calculate_root_fingerprint, scan_project_repository, ScannedProjectMetadata};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProjectMemory {
    pub name: String,
    pub slug: String,
    pub path: String,
    pub repository: Option<String>,
    pub tech_stack: Vec<crate::project_scanner::TechStackDetected>,
    pub architecture: String,
    pub root_fingerprint: String,
    pub last_scanned: u64,
}

pub fn get_orbit_home() -> PathBuf {
    let home = {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(PathBuf::from)
        }
    }
    .unwrap_or_else(|| PathBuf::from("."));
    home.join(".orbit")
}

pub fn get_project_canonical_dir(slug: &str) -> PathBuf {
    get_orbit_home().join("projects").join(slug)
}

pub fn get_project_legacy_dir(slug: &str) -> PathBuf {
    get_orbit_home().join("memory").join("projects").join(slug)
}

pub fn slugify_project_name(name: &str) -> String {
    let slug = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '-' })
        .collect::<String>();
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed
    }
}

/// Appends a raw JSON line to ~/.orbit/projects/<slug>/events.jsonl
pub fn append_event_to_ledger(slug: &str, event_json_line: &str) -> Result<(), String> {
    let proj_dir = get_project_canonical_dir(slug);
    let _ = std::fs::create_dir_all(&proj_dir);
    let events_file = proj_dir.join("events.jsonl");

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&events_file)
        .map_err(|e| format!("Failed to open events.jsonl: {}", e))?;

    let line = if event_json_line.ends_with('\n') {
        event_json_line.to_string()
    } else {
        format!("{}\n", event_json_line)
    };

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed to write event to ledger: {}", e))?;

    Ok(())
}

/// Automatically loads or initializes project memory. Uses fingerprint caching to
/// avoid redundant scans on unchanged projects.
pub fn initialize_or_load_project_memory(
    project_path_str: &str,
    workspace_name: Option<&str>,
) -> Result<StoredProjectMemory, String> {
    let project_path = PathBuf::from(project_path_str);
    let raw_name = workspace_name
        .filter(|n| !n.trim().is_empty())
        .map(|n| n.to_string())
        .unwrap_or_else(|| {
            project_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "project".to_string())
        });

    let slug = slugify_project_name(&raw_name);
    let canonical_dir = get_project_canonical_dir(&slug);
    let _ = std::fs::create_dir_all(&canonical_dir);

    let legacy_dir = get_project_legacy_dir(&slug);
    let _ = std::fs::create_dir_all(&legacy_dir);

    let project_json_path = canonical_dir.join("project.json");

    // 1. Check if cached project.json exists and if fingerprint is unchanged
    if project_path.exists() {
        let current_fingerprint = calculate_root_fingerprint(&project_path);

        if project_json_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&project_json_path) {
                if let Ok(cached) = serde_json::from_str::<StoredProjectMemory>(&content) {
                    if cached.root_fingerprint == current_fingerprint {
                        // Cache hit! Return immediately without rescan
                        return Ok(cached);
                    }
                }
            }
        }

        // 2. Cache miss or first scan — perform scan
        let scanned = scan_project_repository(project_path_str)?;
        let stored = StoredProjectMemory {
            name: scanned.name,
            slug: slug.clone(),
            path: scanned.root_path,
            repository: scanned.repository,
            tech_stack: scanned.tech_stack,
            architecture: scanned.architecture,
            root_fingerprint: scanned.root_fingerprint,
            last_scanned: scanned.last_scanned,
        };

        // Persist project.json
        if let Ok(serialized) = serde_json::to_string_pretty(&stored) {
            let _ = std::fs::write(&project_json_path, serialized);
        }

        // Emit repository.scanned event to events.jsonl
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let event_id = format!("evt_scan_{}", now);
        let scan_event = serde_json::json!({
            "eventId": event_id,
            "type": "repository.scanned",
            "projectId": slug,
            "sessionId": "boot_scanner",
            "timestamp": now,
            "payload": stored,
            "provenance": {
                "sourceType": "repository",
                "sourceId": "project_scanner",
                "timestamp": now,
                "confidence": "verified",
                "verificationLevel": "file_verified",
                "evidence": ["package.json", "Cargo.toml", "tsconfig.json"]
            }
        });
        let _ = append_event_to_ledger(&slug, &scan_event.to_string());

        // Materialize views
        materialize_markdown_views(&canonical_dir, &legacy_dir, &stored);

        return Ok(stored);
    }

    // Default fallback if project path does not exist on disk
    let fallback = StoredProjectMemory {
        name: raw_name,
        slug: slug.clone(),
        path: project_path_str.to_string(),
        repository: None,
        tech_stack: Vec::new(),
        architecture: "Standard Project".to_string(),
        root_fingerprint: "none".to_string(),
        last_scanned: 0,
    };
    Ok(fallback)
}

/// Generates materialized views (*.md) from the structured project state
pub fn materialize_markdown_views(canonical_dir: &Path, legacy_dir: &Path, state: &StoredProjectMemory) {
    let views_dir = canonical_dir.join("views");
    let _ = std::fs::create_dir_all(&views_dir);

    let header = "<!-- Generated view maintained by Orbit. Direct edits should be made via Orbit or will be overwritten during view projection. -->\n\n";

    let stack_str = if state.tech_stack.is_empty() {
        "• None detected yet".to_string()
    } else {
        state
            .tech_stack
            .iter()
            .map(|t| format!("• **{}** ({}, verification: `{}`) — via `{}`", t.name, t.category, t.verification_level, t.source))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let master_content = format!(
        "{}# {} — Master Project Reference\n\n- **Project Root**: `{}`\n- **Repository**: `{}`\n- **Architecture**: {}\n\n## Detected Tech Stack\n{}\n",
        header,
        state.name,
        state.path,
        state.repository.as_deref().unwrap_or("Local project"),
        state.architecture,
        stack_str
    );

    let session_content = format!(
        "{}# {} Project Memory — Cumulative Sessions\n\n> Initialized by Orbit Continuous Memory Engine.\n\n## Project Status\n- **Project**: {}\n- **Architecture**: {}\n- **Status**: Workspace initialized & tech stack verified\n",
        header, state.name, state.name, state.architecture
    );

    let decisions_content = format!(
        "{}# {} Project — Architectural Decisions Record\n\n> Historical and active architectural invariants with verification lineage.\n",
        header, state.name
    );

    let bugs_content = format!(
        "{}# {} Project — Tracked Blockers & Issues\n\n> Active issues, edge cases, and known bugs.\n",
        header, state.name
    );

    let invariants_content = format!(
        "{}# {} Project — Invariants & Guardrails\n\n- INV-001: PTY represents display state; native provider transcripts are authoritative over PTY output.\n- INV-002: Strict typing and preserved verification contracts.\n",
        header, state.name
    );

    let roadmap_content = format!(
        "{}# Roadmap — {}\n\n> Multi-agent continuous roadmap maintained by Orbit.\n\n## Phase 0 — Foundation & Runtime Architecture\n- [x] Workspace initialized and project memory configured\n- [x] Multi-agent runtime & deterministic context relay operational\n\n## Phase 1 — Active Core Implementation\n- [/] {}\n- [ ] Comprehensive verification across test suites\n",
        header, state.name, state.architecture
    );

    let _ = std::fs::write(views_dir.join("MASTER.md"), &master_content);
    let _ = std::fs::write(views_dir.join("SESSION.md"), &session_content);
    let _ = std::fs::write(views_dir.join("DECISIONS.md"), &decisions_content);
    let _ = std::fs::write(views_dir.join("BUGS.md"), &bugs_content);
    let _ = std::fs::write(views_dir.join("INVARIANTS.md"), &invariants_content);
    let _ = std::fs::write(views_dir.join("ROADMAP.md"), &roadmap_content);

    // Also mirror to legacy dir so existing pointers continue to resolve
    let _ = std::fs::write(legacy_dir.join("SESSION.md"), &session_content);
    let _ = std::fs::write(legacy_dir.join("DECISIONS.md"), &decisions_content);
    let _ = std::fs::write(legacy_dir.join("BUGS.md"), &bugs_content);
    let _ = std::fs::write(legacy_dir.join("ROADMAP.md"), &roadmap_content);
}
