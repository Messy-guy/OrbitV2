use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TechStackDetected {
    pub name: String,
    pub category: String, // "language", "framework", "library", "package_manager", "database"
    pub verification_level: String, // "file_verified", "git_verified"
    pub source: String,   // e.g. "package.json", "Cargo.toml"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedProjectMetadata {
    pub name: String,
    pub root_path: String,
    pub repository: Option<String>,
    pub tech_stack: Vec<TechStackDetected>,
    pub architecture: String,
    pub root_fingerprint: String,
    pub last_scanned: u64,
}

/// Calculates a lightweight root fingerprint based on file metadata (mtime + size)
/// of key manifest and config files to bypass redundant scans on unchanged projects.
pub fn calculate_root_fingerprint(project_path: &Path) -> String {
    let key_files = [
        "package.json",
        "Cargo.toml",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "tsconfig.json",
        "Dockerfile",
        "docker-compose.yml",
        ".env.example",
    ];

    let mut parts = Vec::new();
    for rel in &key_files {
        let p = project_path.join(rel);
        if let Ok(meta) = p.metadata() {
            let size = meta.len();
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            parts.push(format!("{}:{}:{}", rel, size, mtime));
        }
    }

    if parts.is_empty() {
        "empty_repo_fingerprint".to_string()
    } else {
        parts.join(";")
    }
}

/// Performs a scoped v1 repository scan inspecting package.json, Cargo.toml,
/// tsconfig.json, docker, and directory structure without full monorepo traversal.
pub fn scan_project_repository(project_path_str: &str) -> Result<ScannedProjectMetadata, String> {
    let project_path = PathBuf::from(project_path_str);
    if !project_path.exists() {
        return Err(format!("Project path does not exist: {}", project_path_str));
    }

    let mut tech_stack: Vec<TechStackDetected> = Vec::new();
    let mut detected_arch_parts: Vec<String> = Vec::new();
    let mut project_name = project_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());
    let mut repo_url: Option<String> = None;

    // 1. Inspect package.json (Node / TS / Web)
    let package_json_path = project_path.join("package.json");
    if package_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&package_json_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(name) = v.get("name").and_then(|n| n.as_str()) {
                    if !name.trim().is_empty() {
                        project_name = name.trim().to_string();
                    }
                }
                tech_stack.push(TechStackDetected {
                    name: "Node.js".to_string(),
                    category: "runtime".to_string(),
                    verification_level: "file_verified".to_string(),
                    source: "package.json".to_string(),
                });

                let check_dep = |dep_name: &str| -> bool {
                    v.get("dependencies").and_then(|d| d.get(dep_name)).is_some()
                        || v.get("devDependencies").and_then(|d| d.get(dep_name)).is_some()
                };

                if check_dep("typescript") || project_path.join("tsconfig.json").exists() {
                    tech_stack.push(TechStackDetected {
                        name: "TypeScript".to_string(),
                        category: "language".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("react") {
                    tech_stack.push(TechStackDetected {
                        name: "React".to_string(),
                        category: "framework".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("next") {
                    tech_stack.push(TechStackDetected {
                        name: "Next.js".to_string(),
                        category: "framework".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("tailwindcss") || project_path.join("tailwind.config.js").exists() || project_path.join("tailwind.config.ts").exists() {
                    tech_stack.push(TechStackDetected {
                        name: "Tailwind CSS".to_string(),
                        category: "framework".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("prisma") || project_path.join("prisma").exists() {
                    tech_stack.push(TechStackDetected {
                        name: "Prisma".to_string(),
                        category: "library".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("drizzle-orm") {
                    tech_stack.push(TechStackDetected {
                        name: "Drizzle".to_string(),
                        category: "library".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("pg") || check_dep("@types/pg") {
                    tech_stack.push(TechStackDetected {
                        name: "PostgreSQL".to_string(),
                        category: "database".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }

                if check_dep("better-sqlite3") || check_dep("sqlite3") {
                    tech_stack.push(TechStackDetected {
                        name: "SQLite".to_string(),
                        category: "database".to_string(),
                        verification_level: "file_verified".to_string(),
                        source: "package.json".to_string(),
                    });
                }
            }
        }
    }

    // 2. Package Manager
    if project_path.join("pnpm-lock.yaml").exists() {
        tech_stack.push(TechStackDetected {
            name: "pnpm".to_string(),
            category: "package_manager".to_string(),
            verification_level: "file_verified".to_string(),
            source: "pnpm-lock.yaml".to_string(),
        });
    } else if project_path.join("yarn.lock").exists() {
        tech_stack.push(TechStackDetected {
            name: "yarn".to_string(),
            category: "package_manager".to_string(),
            verification_level: "file_verified".to_string(),
            source: "yarn.lock".to_string(),
        });
    } else if project_path.join("package-lock.json").exists() {
        tech_stack.push(TechStackDetected {
            name: "npm".to_string(),
            category: "package_manager".to_string(),
            verification_level: "file_verified".to_string(),
            source: "package-lock.json".to_string(),
        });
    }

    // 3. Inspect Cargo.toml (Rust / Tauri / Systems)
    let cargo_toml_path = project_path.join("Cargo.toml");
    let src_tauri_cargo = project_path.join("src-tauri").join("Cargo.toml");
    let is_rust = cargo_toml_path.exists() || src_tauri_cargo.exists();

    if is_rust {
        tech_stack.push(TechStackDetected {
            name: "Rust".to_string(),
            category: "language".to_string(),
            verification_level: "file_verified".to_string(),
            source: if cargo_toml_path.exists() { "Cargo.toml".to_string() } else { "src-tauri/Cargo.toml".to_string() },
        });

        let target_cargo = if cargo_toml_path.exists() { &cargo_toml_path } else { &src_tauri_cargo };
        if let Ok(cargo_content) = std::fs::read_to_string(target_cargo) {
            if cargo_content.contains("tauri =") || src_tauri_cargo.exists() {
                tech_stack.push(TechStackDetected {
                    name: "Tauri".to_string(),
                    category: "framework".to_string(),
                    verification_level: "file_verified".to_string(),
                    source: "Cargo.toml".to_string(),
                });
                detected_arch_parts.push("Desktop Application (Tauri + Web Frontend)".to_string());
            }
        }
    }

    // 4. Git Remote
    let git_config_path = project_path.join(".git").join("config");
    if git_config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&git_config_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("url = ") {
                    let u = trimmed.trim_start_matches("url = ").trim();
                    repo_url = Some(u.to_string());
                    break;
                }
            }
        }
    }

    // 5. Build Architecture Summary
    if detected_arch_parts.is_empty() {
        let has_src = project_path.join("src").exists();
        let has_app = project_path.join("app").exists();
        let has_components = project_path.join("components").exists() || project_path.join("src").join("components").exists();
        if has_app {
            detected_arch_parts.push("Modern App Directory Structure".to_string());
        } else if has_src && has_components {
            detected_arch_parts.push("Component-Driven Architecture (src/components)".to_string());
        } else if has_src {
            detected_arch_parts.push("Modular Standard Source Layout (src/)".to_string());
        } else {
            detected_arch_parts.push("Flat Root Workspace".to_string());
        }
    }

    let arch_summary = detected_arch_parts.join(" | ");
    let fingerprint = calculate_root_fingerprint(&project_path);
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(ScannedProjectMetadata {
        name: project_name,
        root_path: project_path.to_string_lossy().to_string(),
        repository: repo_url,
        tech_stack,
        architecture: arch_summary,
        root_fingerprint: fingerprint,
        last_scanned: now,
    })
}
