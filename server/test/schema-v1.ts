export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  model TEXT NOT NULL,
  permission_mode TEXT NOT NULL,
  cwd TEXT NOT NULL,
  autostart INTEGER NOT NULL,
  allowed_tools TEXT NOT NULL,
  disallowed_tools TEXT NOT NULL,
  system_prompt TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  topic TEXT,
  private INTEGER NOT NULL,
  reply_mode TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  member_key TEXT NOT NULL,
  agent_id TEXT REFERENCES agents (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, member_key)
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  claude_session_id TEXT,
  state TEXT NOT NULL,
  started_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_events (
  session_id TEXT NOT NULL REFERENCES agent_sessions (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  direction TEXT NOT NULL,
  line TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (session_id, seq)
);

CREATE TABLE IF NOT EXISTS timeline_items (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  session_id TEXT REFERENCES agent_sessions (id) ON DELETE SET NULL,
  author_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  tool_use_id TEXT,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS timeline_items_order
  ON timeline_items (conversation_id, seq);
`
