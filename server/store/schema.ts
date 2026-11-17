import type { DatabaseSync } from "node:sqlite"
import { slugOf } from "../agent-names.ts"

export const SCHEMA = `
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

export const MIGRATIONS: {
  version: number
  sql: string
  rebuild?: true
  foreignKeysOff?: true
  run?: (db: DatabaseSync) => void
}[] = [
  {
    version: 2,
    rebuild: true,
    sql: `
      ALTER TABLE agent_sessions ADD COLUMN ended_at TEXT;
      ALTER TABLE agent_sessions ADD COLUMN exit_code INTEGER;
      ALTER TABLE agent_sessions ADD COLUMN stderr TEXT;
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE agent_sessions ADD COLUMN config TEXT;
      ALTER TABLE agent_sessions
        ADD COLUMN claude_session_new INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE conversation_members
        ADD COLUMN joined_seq INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE conversation_reads (
        conversation_id TEXT PRIMARY KEY
          REFERENCES conversations (id) ON DELETE CASCADE,
        last_read_seq INTEGER NOT NULL,
        read_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE agents ADD COLUMN description TEXT;
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE agents ADD COLUMN max_turns INTEGER;
    `,
  },
  {
    version: 8,
    foreignKeysOff: true,
    sql: `
      CREATE TABLE agents_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        colour TEXT NOT NULL,
        model TEXT NOT NULL,
        permission_mode TEXT NOT NULL,
        cwd TEXT,
        autostart INTEGER NOT NULL,
        allowed_tools TEXT NOT NULL,
        disallowed_tools TEXT NOT NULL,
        system_prompt TEXT,
        created_at TEXT NOT NULL,
        description TEXT,
        max_turns INTEGER
      );
      INSERT INTO agents_new
        SELECT id, name, colour, model, permission_mode, cwd, autostart,
          allowed_tools, disallowed_tools, system_prompt, created_at,
          description, max_turns
        FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_new RENAME TO agents;
      ALTER TABLE conversations ADD COLUMN cwd TEXT;
    `,
  },
  {
    version: 9,
    sql: `
      CREATE TABLE shared_files (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL
          REFERENCES conversations (id) ON DELETE CASCADE,
        item_id TEXT REFERENCES timeline_items (id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        kind TEXT NOT NULL,
        size INTEGER NOT NULL,
        shared_by TEXT NOT NULL,
        shared_at TEXT NOT NULL,
        removed_at TEXT,
        removed_by TEXT,
        UNIQUE (conversation_id, path)
      );
    `,
  },
  {
    version: 10,
    sql: `
      ALTER TABLE agents ADD COLUMN sleep_after_minutes INTEGER;
      ALTER TABLE conversations ADD COLUMN sleep_after_minutes INTEGER;
      ALTER TABLE agent_sessions ADD COLUMN end_reason TEXT;
    `,
  },
  {
    version: 11,
    sql: `
      CREATE TABLE conversation_summaries (
        conversation_id TEXT NOT NULL
          REFERENCES conversations (id) ON DELETE CASCADE,
        through_seq INTEGER NOT NULL,
        text TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (conversation_id, through_seq)
      );
    `,
  },
  {
    version: 12,
    sql: `
      ALTER TABLE agents ADD COLUMN deleted_at TEXT;
    `,
  },
  {
    version: 13,
    sql: `
      ALTER TABLE agents ADD COLUMN display_name TEXT;
    `,
    run: giveUsernames,
  },
]

function giveUsernames(db: DatabaseSync) {
  const live = db
    .prepare(
      `SELECT id, name FROM agents WHERE deleted_at IS NULL
       ORDER BY created_at, id`
    )
    .all()
    .map((row) => ({ id: String(row.id), name: String(row.name) }))
  const fits = (name: string) => /^[a-z0-9-]+$/.test(name)
  const rename = db.prepare(
    "UPDATE agents SET name = ?, display_name = ? WHERE id = ?"
  )
  const taken = new Set<string>()
  for (const agent of [
    ...live.filter((agent) => fits(agent.name)),
    ...live.filter((agent) => !fits(agent.name)),
  ]) {
    const slug = slugOf(agent.name)
    let username = slug
    for (let suffix = 2; taken.has(username); suffix++) {
      username = `${slug}-${suffix}`
    }
    taken.add(username)
    if (username === agent.name) continue
    rename.run(username, slug === agent.name ? null : agent.name, agent.id)
  }
  db.exec(
    `CREATE UNIQUE INDEX agents_live_name ON agents (name)
     WHERE deleted_at IS NULL`
  )
}
