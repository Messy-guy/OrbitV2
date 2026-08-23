use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct McpRoleManager {
    // agent_id -> active role
    agent_roles: Arc<Mutex<HashMap<String, String>>>,
}

impl McpRoleManager {
    pub fn new() -> Self {
        Self {
            agent_roles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_agent_role(&self, agent_id: &str, role: &str) {
        let mut map = self.agent_roles.lock().unwrap();
        map.insert(agent_id.to_string(), role.to_string());
    }

    pub fn get_agent_role(&self, agent_id: &str) -> String {
        let map = self.agent_roles.lock().unwrap();
        map.get(agent_id).cloned().unwrap_or_else(|| "raw".to_string())
    }

    /// Returns the allowed tool list for the current role
    pub fn get_tools_for_role(&self, role: &str) -> Vec<McpToolDefinition> {
        match role {
            "architect" => {
                // PLAN MODE: Read & Spec tools only. NO write tools allowed.
                vec![
                    McpToolDefinition {
                        name: "read_file".to_string(),
                        description: "Read contents of a file in the workspace".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" }
                            },
                            "required": ["path"]
                        }),
                    },
                    McpToolDefinition {
                        name: "search_codebase".to_string(),
                        description: "Search symbols and files in the workspace".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "query": { "type": "string" }
                            },
                            "required": ["query"]
                        }),
                    },
                    McpToolDefinition {
                        name: "run_tests".to_string(),
                        description: "Run automated test suites in read-only mode".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "test_filter": { "type": "string" }
                            }
                        }),
                    },
                ]
            }
            "reviewer" => {
                // REVIEW MODE: Diff & Security audit tools only.
                vec![
                    McpToolDefinition {
                        name: "get_git_diff".to_string(),
                        description: "Inspect uncommitted git diffs across the workspace".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                    McpToolDefinition {
                        name: "read_file".to_string(),
                        description: "Read contents of a file in the workspace".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" }
                            },
                            "required": ["path"]
                        }),
                    },
                    McpToolDefinition {
                        name: "run_linter".to_string(),
                        description: "Run type checker and linter".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                ]
            }
            "implementer" | "code" => {
                // CODE MODE: Full implementation capabilities (bounded to code paths).
                vec![
                    McpToolDefinition {
                        name: "read_file".to_string(),
                        description: "Read contents of a file in the workspace".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" }
                            },
                            "required": ["path"]
                        }),
                    },
                    McpToolDefinition {
                        name: "write_file".to_string(),
                        description: "Write code to source files (src/**, app/**)".to_string(),
                        input_schema: serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" },
                                "content": { "type": "string" }
                            },
                            "required": ["path", "content"]
                        }),
                    },
                    McpToolDefinition {
                        name: "run_tests".to_string(),
                        description: "Run automated test suites to verify implementation".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                ]
            }
            _ => {
                // SHELL / UNCONSTRAINED MODE: Full access
                vec![
                    McpToolDefinition {
                        name: "read_file".to_string(),
                        description: "Read file".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                    McpToolDefinition {
                        name: "write_file".to_string(),
                        description: "Write file".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                    McpToolDefinition {
                        name: "bash".to_string(),
                        description: "Execute bash command".to_string(),
                        input_schema: serde_json::json!({ "type": "object" }),
                    },
                ]
            }
        }
    }

    /// Validates if an action is permitted under the current role
    pub fn is_action_allowed(&self, agent_id: &str, tool_name: &str) -> Result<(), String> {
        let role = self.get_agent_role(agent_id);

        if role == "architect" && (tool_name == "write_file" || tool_name == "edit_file" || tool_name == "bash_mutate") {
            return Err("PERMISSION_DENIED: Write operations are disabled in PLAN Mode. Focus on SPEC.md and test contracts.".to_string());
        }

        if role == "reviewer" && (tool_name == "write_file" || tool_name == "edit_file" || tool_name == "bash_mutate") {
            return Err("PERMISSION_DENIED: Write operations are disabled in REVIEW Mode. Focus on diff audit and security findings.".to_string());
        }

        Ok(())
    }
}
