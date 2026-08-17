# Conceptual Data Model & Database Schema

> **IMPORTANT NOTE**:
> No database is implemented in Phase 1. All data is managed through in-memory Zustand state and realistic mock fixtures.

## Conceptual Future Schema (Phase 2+)

### Workspace
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Agent
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'antigravity' | 'codex' | 'claude' | 'opencode' | 'custom'
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,   -- 'working' | 'ready' | 'waiting' | 'paused' | 'error'
  created_at INTEGER NOT NULL
);
```

### Session
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,   -- 'active' | 'paused' | 'completed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Message
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,     -- 'user' | 'agent' | 'system' | 'tool'
  content TEXT NOT NULL,
  tool_invocations TEXT,  -- JSON string of tool files/statuses
  timestamp INTEGER NOT NULL
);
```

### ProjectContext
```sql
CREATE TABLE project_contexts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  progress INTEGER NOT NULL, -- 0 to 100
  decisions TEXT NOT NULL,   -- JSON array
  issues TEXT NOT NULL,      -- JSON array
  architecture TEXT NOT NULL,
  relevant_files TEXT NOT NULL, -- JSON array
  updated_at INTEGER NOT NULL
);
```

### Checkpoint
```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Handoff
```sql
CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_session_id TEXT NOT NULL REFERENCES sessions(id),
  target_session_id TEXT NOT NULL REFERENCES sessions(id),
  selected_context TEXT NOT NULL, -- JSON flags/payload
  generated_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Activity
```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,      -- 'agent_started' | 'file_changed' | 'test_run' | 'checkpoint' | 'handoff'
  agent_id TEXT REFERENCES agents(id),
  description TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```
