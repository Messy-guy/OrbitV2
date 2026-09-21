use crate::models::{ChangedFileItem, GitFileDiffData, GitState};
use std::path::Path;
use std::process::Command;

pub fn inspect_git_state(project_path: &str) -> GitState {
    let path = Path::new(project_path);
    if !path.exists() {
        return GitState {
            current_branch: "main".to_string(),
            head_commit: "unknown".to_string(),
            modified_files: Vec::new(),
            staged_files: Vec::new(),
            unstaged_files: Vec::new(),
            untracked_files: Vec::new(),
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
                if !name.is_empty() {
                    Some(name)
                } else {
                    None
                }
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
                if !h.is_empty() {
                    Some(h)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "initial".to_string());

    let mut modified_files = Vec::new();
    let mut staged_files = Vec::new();
    let mut unstaged_files = Vec::new();
    let mut untracked_files = Vec::new();

    // 3. Get changed files via git status --porcelain=v1
    if let Ok(status_out) = Command::new("git")
        .args(["status", "--porcelain=v1"])
        .current_dir(path)
        .output()
    {
        if status_out.status.success() {
            let output_str = String::from_utf8_lossy(&status_out.stdout);
            for line in output_str.lines() {
                if line.len() < 3 {
                    continue;
                }
                let bytes = line.as_bytes();
                let x = bytes[0] as char;
                let y = bytes[1] as char;
                let rest = line[3..].trim();
                let file_path = if let Some(idx) = rest.find(" -> ") {
                    rest[idx + 4..].trim().trim_matches('"').to_string()
                } else {
                    rest.trim_matches('"').to_string()
                };

                if file_path.is_empty() {
                    continue;
                }

                if x == '?' && y == '?' {
                    let item = ChangedFileItem {
                        path: file_path.clone(),
                        status: "untracked".to_string(),
                        staged: false,
                        unstaged: true,
                        is_untracked: true,
                        diff_snippet: None,
                        verification_level: None,
                    };
                    untracked_files.push(item.clone());
                    modified_files.push(item);
                } else {
                    // Staged index status (X)
                    if x != ' ' && x != '?' {
                        let status = match x {
                            'M' => "modified",
                            'A' => "added",
                            'D' => "deleted",
                            'R' => "renamed",
                            'C' => "copied",
                            _ => "staged",
                        };
                        staged_files.push(ChangedFileItem {
                            path: file_path.clone(),
                            status: status.to_string(),
                            staged: true,
                            unstaged: false,
                            is_untracked: false,
                            diff_snippet: None,
                            verification_level: None,
                        });
                    }

                    // Unstaged working tree status (Y)
                    if y != ' ' && y != '?' {
                        let status = match y {
                            'M' => "modified",
                            'D' => "deleted",
                            _ => "modified",
                        };
                        unstaged_files.push(ChangedFileItem {
                            path: file_path.clone(),
                            status: status.to_string(),
                            staged: false,
                            unstaged: true,
                            is_untracked: false,
                            diff_snippet: None,
                            verification_level: None,
                        });
                    }

                    let overall_status = if x == 'A' {
                        "added"
                    } else if x == 'D' || y == 'D' {
                        "deleted"
                    } else {
                        "modified"
                    };

                    modified_files.push(ChangedFileItem {
                        path: file_path,
                        status: overall_status.to_string(),
                        staged: x != ' ' && x != '?',
                        unstaged: y != ' ' && y != '?',
                        is_untracked: false,
                        diff_snippet: None,
                        verification_level: None,
                    });
                }
            }
        }
    }

    // 4. Get recent commits (last 10)
    let mut recent_commits = Vec::new();
    if let Ok(log_out) = Command::new("git")
        .args(["log", "-n", "10", "--oneline"])
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
        staged_files,
        unstaged_files,
        untracked_files,
        recent_commits,
    }
}

pub fn get_git_diff_summary(project_path: &str) -> String {
    let path = Path::new(project_path);
    if !path.exists() {
        return "No git repository found at workspace path.".to_string();
    }

    let diff_output = Command::new("git")
        .args(["diff", "HEAD", "--stat"])
        .current_dir(path)
        .output()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).to_string())
        .unwrap_or_default();

    if diff_output.trim().is_empty() {
        "Working tree is clean. No uncommitted diffs found.".to_string()
    } else {
        diff_output
    }
}

pub fn is_safe_rel_path(file_path: &str) -> bool {
    let p = std::path::Path::new(file_path);
    if p.is_absolute() {
        return false;
    }
    for component in p.components() {
        if matches!(component, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_)) {
            return false;
        }
    }
    true
}

pub fn get_git_file_diff(project_path: &str, file_path: &str) -> String {
    let path = Path::new(project_path);
    if !path.exists() || !is_safe_rel_path(file_path) {
        return "No changes detected for this file.".to_string();
    }

    // 1. Try standard working-tree diff against HEAD
    let diff_output = Command::new("git")
        .args(["diff", "HEAD", "--", file_path])
        .current_dir(path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() && !out.stdout.is_empty() {
                Some(String::from_utf8_lossy(&out.stdout).to_string())
            } else {
                None
            }
        });

    if let Some(diff) = diff_output {
        if !diff.trim().is_empty() {
            return diff;
        }
    }

    // 2. Try unstaged diff
    let unstaged_output = Command::new("git")
        .args(["diff", "--", file_path])
        .current_dir(path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() && !out.stdout.is_empty() {
                Some(String::from_utf8_lossy(&out.stdout).to_string())
            } else {
                None
            }
        });

    if let Some(diff) = unstaged_output {
        if !diff.trim().is_empty() {
            return diff;
        }
    }

    // 3. For newly created untracked files, synthesize unified diff from full content
    let full_file_path = path.join(file_path);
    if full_file_path.exists() && full_file_path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&full_file_path) {
            let mut synth = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", file_path, content.lines().count().max(1));
            for line in content.lines() {
                synth.push('+');
                synth.push_str(line);
                synth.push('\n');
            }
            return synth;
        }
    }

    "No changes detected for this file.".to_string()
}

pub fn get_git_file_diff_data(project_path: &str, file_path: &str, is_staged: Option<bool>) -> GitFileDiffData {
    let path = Path::new(project_path);
    let staged = is_staged.unwrap_or(false);
    let full_path = path.join(file_path);

    let mut original_content = String::new();
    let mut modified_content = String::new();
    let mut diff = String::new();
    let mut status = "modified".to_string();

    if staged {
        // Staged diff compares HEAD -> Index
        if let Ok(out) = Command::new("git")
            .args(["show", &format!("HEAD:{}", file_path)])
            .current_dir(path)
            .output()
        {
            if out.status.success() {
                original_content = String::from_utf8_lossy(&out.stdout).to_string();
            }
        }
        if let Ok(out) = Command::new("git")
            .args(["show", &format!(":{}", file_path)])
            .current_dir(path)
            .output()
        {
            if out.status.success() {
                modified_content = String::from_utf8_lossy(&out.stdout).to_string();
            }
        }
        if let Ok(out) = Command::new("git")
            .args(["diff", "--cached", "--", file_path])
            .current_dir(path)
            .output()
        {
            if out.status.success() {
                diff = String::from_utf8_lossy(&out.stdout).to_string();
            }
        }
    } else {
        // Unstaged diff compares Index/HEAD -> Working tree
        let mut got_orig = false;
        if let Ok(out) = Command::new("git")
            .args(["show", &format!(":{}", file_path)])
            .current_dir(path)
            .output()
        {
            if out.status.success() {
                original_content = String::from_utf8_lossy(&out.stdout).to_string();
                got_orig = true;
            }
        }
        if !got_orig {
            if let Ok(out) = Command::new("git")
                .args(["show", &format!("HEAD:{}", file_path)])
                .current_dir(path)
                .output()
            {
                if out.status.success() {
                    original_content = String::from_utf8_lossy(&out.stdout).to_string();
                }
            }
        }

        if full_path.exists() && full_path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&full_path) {
                modified_content = content;
            }
        }

        if let Ok(out) = Command::new("git")
            .args(["diff", "--", file_path])
            .current_dir(path)
            .output()
        {
            if out.status.success() && !out.stdout.is_empty() {
                diff = String::from_utf8_lossy(&out.stdout).to_string();
            }
        }
        if diff.trim().is_empty() {
            if let Ok(out) = Command::new("git")
                .args(["diff", "HEAD", "--", file_path])
                .current_dir(path)
                .output()
            {
                if out.status.success() && !out.stdout.is_empty() {
                    diff = String::from_utf8_lossy(&out.stdout).to_string();
                }
            }
        }

        if diff.trim().is_empty() && original_content.is_empty() && !modified_content.is_empty() {
            status = "untracked".to_string();
            let mut synth = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", file_path, modified_content.lines().count().max(1));
            for line in modified_content.lines() {
                synth.push('+');
                synth.push_str(line);
                synth.push('\n');
            }
            diff = synth;
        }
    }

    if original_content.is_empty() && !modified_content.is_empty() {
        status = if staged { "added".to_string() } else { "untracked".to_string() };
    } else if !original_content.is_empty() && modified_content.is_empty() {
        status = "deleted".to_string();
    }

    GitFileDiffData {
        file_path: file_path.to_string(),
        original_content,
        modified_content,
        diff,
        status,
        is_staged: staged,
    }
}

pub fn stage_file(project_path: &str, file_path: &str) -> Result<(), String> {
    if !is_safe_rel_path(file_path) {
        return Err("Invalid file path: path traversal is not permitted".to_string());
    }
    let path = Path::new(project_path);
    let output = Command::new("git")
        .args(["add", "--", file_path])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn unstage_file(project_path: &str, file_path: &str) -> Result<(), String> {
    if !is_safe_rel_path(file_path) {
        return Err("Invalid file path: path traversal is not permitted".to_string());
    }
    let path = Path::new(project_path);
    // Try git restore --staged first
    let res = Command::new("git")
        .args(["restore", "--staged", "--", file_path])
        .current_dir(path)
        .output();

    if let Ok(out) = res {
        if out.status.success() {
            return Ok(());
        }
    }

    // Fallback to git reset HEAD
    let output = Command::new("git")
        .args(["reset", "HEAD", "--", file_path])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git reset: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn stage_all(project_path: &str) -> Result<(), String> {
    let path = Path::new(project_path);
    let output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git add -A: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn unstage_all(project_path: &str) -> Result<(), String> {
    let path = Path::new(project_path);
    let res = Command::new("git")
        .args(["restore", "--staged", "."])
        .current_dir(path)
        .output();

    if let Ok(out) = res {
        if out.status.success() {
            return Ok(());
        }
    }

    let output = Command::new("git")
        .args(["reset", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git reset: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn discard_file(project_path: &str, file_path: &str) -> Result<(), String> {
    if !is_safe_rel_path(file_path) {
        return Err("Invalid file path: path traversal is not permitted".to_string());
    }
    let path = Path::new(project_path);
    let full_path = path.join(file_path);

    // Check if file is untracked
    let ls_out = Command::new("git")
        .args(["ls-files", "--error-unmatch", "--", file_path])
        .current_dir(path)
        .output();

    let is_tracked = ls_out.map(|o| o.status.success()).unwrap_or(false);

    if !is_tracked {
        if full_path.is_file() {
            std::fs::remove_file(&full_path)
                .map_err(|e| format!("Failed to delete untracked file {}: {}", file_path, e))?;
            return Ok(());
        } else if full_path.is_dir() {
            std::fs::remove_dir_all(&full_path)
                .map_err(|e| format!("Failed to delete untracked directory {}: {}", file_path, e))?;
            return Ok(());
        }
    }

    // For tracked files, restore worktree
    let res = Command::new("git")
        .args(["restore", "--worktree", "--", file_path])
        .current_dir(path)
        .output();

    if let Ok(out) = res {
        if out.status.success() {
            return Ok(());
        }
    }

    let output = Command::new("git")
        .args(["checkout", "HEAD", "--", file_path])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to restore file {}: {}", file_path, e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn discard_all(project_path: &str) -> Result<(), String> {
    let path = Path::new(project_path);
    let res = Command::new("git")
        .args(["restore", "--worktree", "."])
        .current_dir(path)
        .output();

    if let Ok(out) = res {
        if out.status.success() {
            return Ok(());
        }
    }

    let output = Command::new("git")
        .args(["checkout", "HEAD", "--", "."])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to discard changes: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn commit_changes(project_path: &str, message: &str) -> Result<String, String> {
    let path = Path::new(project_path);
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    let output = Command::new("git")
        .args(["commit", "-m", message])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubCliRepo {
    pub name: String,
    pub name_with_owner: String,
    #[serde(rename = "isPrivate")]
    pub is_private: bool,
    pub url: String,
    #[serde(rename = "sshUrl")]
    pub ssh_url: Option<String>,
    pub description: Option<String>,
    pub updated_at: Option<String>,
}

pub fn clone_repository(clone_url: &str, target_path: &str) -> Result<String, String> {
    if clone_url.trim().starts_with('-') {
        return Err("Invalid clone URL: cannot start with a dash".to_string());
    }
    if target_path.trim().starts_with('-') {
        return Err("Invalid target path: cannot start with a dash".to_string());
    }

    let target = Path::new(target_path);
    if target.exists() {
        if target.is_dir() {
            if let Ok(mut entries) = std::fs::read_dir(target) {
                if entries.next().is_some() {
                    return Err(format!("Target directory '{}' already exists and is not empty.", target_path));
                }
            }
        } else {
            return Err(format!("Target path '{}' already exists and is a file.", target_path));
        }
    }

    if let Some(parent) = target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let output = Command::new("git")
        .args(["clone", "--progress", "--", clone_url, target_path])
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if output.status.success() {
        let msg = String::from_utf8_lossy(&output.stderr);
        Ok(if msg.trim().is_empty() {
            "Cloned repository successfully.".to_string()
        } else {
            msg.trim().to_string()
        })
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}\n{}", err.trim(), out.trim()).trim().to_string();
        Err(if combined.is_empty() {
            "Git clone failed with unknown error.".to_string()
        } else {
            combined
        })
    }
}

pub fn get_gh_cli_repositories() -> Result<Vec<GitHubCliRepo>, String> {
    let output = Command::new("gh")
        .args([
            "repo",
            "list",
            "--limit",
            "100",
            "--json",
            "name,nameWithOwner,isPrivate,url,sshUrl,description,updatedAt",
        ])
        .output()
        .map_err(|e| format!("GitHub CLI (gh) not found or not executable: {}", e))?;

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        let repos: Vec<GitHubCliRepo> = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse gh output: {}", e))?;
        Ok(repos)
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(err.trim().to_string())
    }
}

