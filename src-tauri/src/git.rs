use std::path::Path;
use std::process::Command;
use crate::models::{ChangedFileItem, GitState};

pub fn inspect_git_state(project_path: &str) -> GitState {
    let path = Path::new(project_path);
    if !path.exists() {
        return GitState {
            current_branch: "main".to_string(),
            head_commit: "unknown".to_string(),
            modified_files: Vec::new(),
            recent_commits: Vec::new(),
        };
    }

    // 1. Get current branch
    let branch = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !name.is_empty() { Some(name) } else { None }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "main".to_string());

    // 2. Get HEAD short commit hash
    let head = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .current_dir(path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let h = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !h.is_empty() { Some(h) } else { None }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "initial".to_string());

    // 3. Get changed files via git status --porcelain
    let mut modified_files = Vec::new();
    if let Ok(status_out) = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
    {
        if status_out.status.success() {
            let output_str = String::from_utf8_lossy(&status_out.stdout);
            for line in output_str.lines() {
                let trimmed = line.trim();
                if trimmed.len() >= 3 {
                    let code = &trimmed[..2].trim();
                    let file_path = trimmed[2..].trim().to_string();
                    let status = match *code {
                        "M" | "MM" | "AM" => "modified",
                        "A" => "added",
                        "D" => "deleted",
                        "??" => "untracked",
                        _ => "modified",
                    };
                    if !file_path.is_empty() {
                        modified_files.push(ChangedFileItem {
                            path: file_path,
                            status: status.to_string(),
                        });
                    }
                }
            }
        }
    }

    // 4. Get recent commits (last 5)
    let mut recent_commits = Vec::new();
    if let Ok(log_out) = Command::new("git")
        .args(["log", "-n", "5", "--oneline"])
        .current_dir(path)
        .output()
    {
        if log_out.status.success() {
            let log_str = String::from_utf8_lossy(&log_out.stdout);
            for line in log_str.lines() {
                if !line.trim().is_empty() {
                    recent_commits.push(line.trim().to_string());
                }
            }
        }
    }

    GitState {
        current_branch: branch,
        head_commit: head,
        modified_files,
        recent_commits,
    }
}
