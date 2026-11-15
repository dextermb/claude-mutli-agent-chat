import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { decodeLine } from "../protocol/decode.ts"
import {
  emptyTimeline,
  reduceTimeline,
  type TimelineItem,
  type TurnItem,
} from "../timeline/reduce.ts"
import type {
  Agent,
  Conversation,
  NewAgent,
  NewConversation,
  SessionConfig,
  TimelineEntry,
} from "../api-types.ts"
import { MIGRATIONS, SCHEMA } from "./schema.ts"

export type {
  Agent,
  Conversation,
  NewAgent,
  NewConversation,
  TimelineEntry,
} from "../api-types.ts"

export type SessionRow = {
  id: string
  agentId: string
  conversationId: string
  claudeSessionId: string | null
  claudeSessionNew: boolean
  config: SessionConfig | null
  state: string
  startedAt: string
  endedAt: string | null
  exitCode: number | null
  stderr: string | null
}

export type StoredLine = {
  seq: number
  direction: "in" | "out"
  text: string
}

export type Store = ReturnType<typeof openStore>

type Row = Record<string, unknown>

export function openStore(location: string) {
  const db = new DatabaseSync(location)
  db.exec(SCHEMA)
  const expireOpenRequests = db.prepare(
    `UPDATE timeline_items
     SET status = 'expired', payload = json_set(payload, '$.status', 'expired')
     WHERE kind IN ('permission', 'question') AND status = 'pending'
       AND (:id IS NULL OR id = :id)`
  )
  migrate()
  expireOpenRequests.run({ id: null })
  db.exec(
    `UPDATE agent_sessions SET state = 'exited'
     WHERE state NOT IN ('exited', 'failed')`
  )

  function createAgent(agent: NewAgent): Agent {
    const created: Agent = {
      ...agent,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    db.prepare(
      `INSERT INTO agents (id, name, colour, model, permission_mode, cwd,
         autostart, allowed_tools, disallowed_tools, system_prompt, created_at)
       VALUES (:id, :name, :colour, :model, :permissionMode, :cwd,
         :autostart, :allowedTools, :disallowedTools, :systemPrompt, :createdAt)`
    ).run({
      ...created,
      autostart: created.autostart ? 1 : 0,
      allowedTools: JSON.stringify(created.allowedTools),
      disallowedTools: JSON.stringify(created.disallowedTools),
    })
    return created
  }

  function updateAgent(id: string, agent: NewAgent): Agent | undefined {
    db.prepare(
      `UPDATE agents SET name = :name, colour = :colour, model = :model,
         permission_mode = :permissionMode, cwd = :cwd, autostart = :autostart,
         allowed_tools = :allowedTools, disallowed_tools = :disallowedTools,
         system_prompt = :systemPrompt
       WHERE id = :id`
    ).run({
      ...agent,
      id,
      autostart: agent.autostart ? 1 : 0,
      allowedTools: JSON.stringify(agent.allowedTools),
      disallowedTools: JSON.stringify(agent.disallowedTools),
    })
    return getAgent(id)
  }

  function listAgents(): Agent[] {
    return db
      .prepare("SELECT * FROM agents ORDER BY name")
      .all()
      .map((row) => toAgent(row as Row))
  }

  function getAgent(id: string): Agent | undefined {
    const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id)
    return row ? toAgent(row as Row) : undefined
  }

  function createConversation(conversation: NewConversation): Conversation {
    const created: Conversation = {
      ...conversation,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    db.prepare(
      `INSERT INTO conversations (id, kind, name, topic, private, reply_mode,
         created_at)
       VALUES (:id, :kind, :name, :topic, :private, :replyMode, :createdAt)`
    ).run({
      id: created.id,
      kind: created.kind,
      name: created.name,
      topic: created.topic,
      private: created.private ? 1 : 0,
      replyMode: created.replyMode,
      createdAt: created.createdAt,
    })
    const addMember = db.prepare(
      `INSERT INTO conversation_members (conversation_id, member_key, agent_id,
         position)
       VALUES (?, ?, ?, ?)`
    )
    created.members.forEach((memberKey, position) => {
      addMember.run(created.id, memberKey, agentIdOf(memberKey), position)
    })
    return created
  }

  function listConversations(): Conversation[] {
    return db
      .prepare("SELECT id FROM conversations ORDER BY created_at, rowid")
      .all()
      .flatMap((row) => getConversation(String(row.id)) ?? [])
  }

  function findDirectMessage(agentId: string): Conversation | undefined {
    const row = db
      .prepare(
        `SELECT conversations.id FROM conversations
         JOIN conversation_members
           ON conversation_members.conversation_id = conversations.id
         WHERE conversations.kind = 'dm' AND conversation_members.agent_id = ?
         LIMIT 1`
      )
      .get(agentId)
    return row ? getConversation(String(row.id)) : undefined
  }

  function getConversation(id: string): Conversation | undefined {
    const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id)
    if (!row) return undefined
    const members = db
      .prepare(
        `SELECT member_key FROM conversation_members
         WHERE conversation_id = ? ORDER BY position`
      )
      .all(id)
      .map((member) => String(member.member_key))
    return toConversation(row as Row, members)
  }

  function createSession(session: {
    agentId: string
    conversationId: string
    claudeSessionId?: string | null
    claudeSessionNew?: boolean
    config?: SessionConfig
  }): SessionRow {
    const created: SessionRow = {
      agentId: session.agentId,
      conversationId: session.conversationId,
      id: randomUUID(),
      claudeSessionId: session.claudeSessionId ?? null,
      claudeSessionNew: session.claudeSessionNew ?? false,
      config: session.config ?? null,
      state: "starting",
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
      stderr: null,
    }
    db.prepare(
      `INSERT INTO agent_sessions (id, agent_id, conversation_id,
         claude_session_id, claude_session_new, config, state, started_at,
         ended_at, exit_code, stderr)
       VALUES (:id, :agentId, :conversationId, :claudeSessionId,
         :claudeSessionNew, :config, :state, :startedAt, :endedAt, :exitCode,
         :stderr)`
    ).run({
      ...created,
      claudeSessionNew: created.claudeSessionNew ? 1 : 0,
      config: created.config ? JSON.stringify(created.config) : null,
    })
    return created
  }

  function getSession(id: string): SessionRow | undefined {
    const row = db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(id)
    return row ? toSession(row as Row) : undefined
  }

  function latestSession(
    agentId: string,
    conversationId: string
  ): SessionRow | undefined {
    const row = db
      .prepare(
        `SELECT * FROM agent_sessions
         WHERE agent_id = ? AND conversation_id = ?
         ORDER BY rowid DESC LIMIT 1`
      )
      .get(agentId, conversationId)
    return row ? toSession(row as Row) : undefined
  }

  function toSession(row: Row): SessionRow {
    return {
      id: String(row.id),
      agentId: String(row.agent_id),
      conversationId: String(row.conversation_id),
      claudeSessionId:
        row.claude_session_id === null ? null : String(row.claude_session_id),
      claudeSessionNew: row.claude_session_new === 1,
      config:
        row.config === null
          ? null
          : (JSON.parse(String(row.config)) as SessionConfig),
      state: String(row.state),
      startedAt: String(row.started_at),
      endedAt: row.ended_at === null ? null : String(row.ended_at),
      exitCode: row.exit_code === null ? null : Number(row.exit_code),
      stderr: row.stderr === null ? null : String(row.stderr),
    }
  }

  function updateSession(
    id: string,
    change: Partial<
      Pick<
        SessionRow,
        | "claudeSessionId"
        | "claudeSessionNew"
        | "state"
        | "endedAt"
        | "exitCode"
        | "stderr"
      >
    >
  ) {
    const current = getSession(id)
    if (!current) return
    const next = { ...current, ...change }
    db.prepare(
      `UPDATE agent_sessions SET claude_session_id = :claudeSessionId,
         claude_session_new = :claudeSessionNew, state = :state, ended_at = :endedAt, exit_code = :exitCode,
         stderr = :stderr
       WHERE id = :id`
    ).run({
      id,
      claudeSessionId: next.claudeSessionId,
      claudeSessionNew: next.claudeSessionNew ? 1 : 0,
      state: next.state,
      endedAt: next.endedAt,
      exitCode: next.exitCode,
      stderr: next.stderr,
    })
  }

  function nextSeq(): number {
    const row = db
      .prepare(
        `SELECT MAX(
           (SELECT COALESCE(MAX(seq), 0) FROM session_events),
           (SELECT COALESCE(MAX(seq), 0) FROM timeline_items)
         ) + 1 AS next`
      )
      .get()
    return Number(row?.next)
  }

  function recordLine(
    sessionId: string,
    direction: "in" | "out",
    text: string
  ): number {
    const seq = nextSeq()
    db.prepare(
      `INSERT INTO session_events (session_id, seq, direction, line, at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, seq, direction, text, new Date().toISOString())
    return seq
  }

  function listLines(sessionId: string): StoredLine[] {
    return db
      .prepare(
        `SELECT seq, direction, line FROM session_events
         WHERE session_id = ? ORDER BY seq`
      )
      .all(sessionId)
      .map((row) => ({
        seq: Number(row.seq),
        direction: String(row.direction) as StoredLine["direction"],
        text: String(row.line),
      }))
  }

  function saveItems(
    sessionId: string,
    items: TimelineItem[],
    seq = nextSeq()
  ): TimelineEntry[] {
    const session = db
      .prepare(
        "SELECT agent_id, conversation_id FROM agent_sessions WHERE id = ?"
      )
      .get(sessionId)
    if (!session) return []
    const line = db
      .prepare("SELECT at FROM session_events WHERE session_id = ? AND seq = ?")
      .get(sessionId, seq)
    const createdAt = line ? String(line.at) : new Date().toISOString()
    const save = db.prepare(
      `INSERT INTO timeline_items (id, conversation_id, seq, session_id,
         author_key, kind, tool_use_id, status, payload, created_at)
       VALUES (:id, :conversationId, :seq, :sessionId, :authorKey, :kind,
         :toolUseId, :status, :payload, :createdAt)
       ON CONFLICT (id) DO UPDATE SET
         status = excluded.status,
         payload = excluded.payload
       RETURNING id, seq, author_key, created_at`
    )
    return items.map((item) => {
      const row = save.get({
        id: `${sessionId}/${item.id}`,
        conversationId: String(session.conversation_id),
        seq,
        sessionId,
        authorKey: `agent:${String(session.agent_id)}`,
        kind: item.kind,
        toolUseId: "toolUseId" in item ? item.toolUseId : null,
        status: item.status,
        payload: JSON.stringify(item),
        createdAt,
      })
      return {
        id: String(row?.id),
        seq: Number(row?.seq),
        authorKey: String(row?.author_key),
        createdAt: String(row?.created_at),
        item,
      }
    })
  }

  function addUserMessage(conversationId: string, text: string): TimelineEntry {
    const id = randomUUID()
    const entry: TimelineEntry = {
      id,
      seq: nextSeq(),
      authorKey: "user:me",
      createdAt: new Date().toISOString(),
      item: { kind: "message", id, text, status: "done" },
    }
    db.prepare(
      `INSERT INTO timeline_items (id, conversation_id, seq, session_id,
         author_key, kind, tool_use_id, status, payload, created_at)
       VALUES (?, ?, ?, NULL, ?, 'message', NULL, 'done', ?, ?)`
    ).run(
      id,
      conversationId,
      entry.seq,
      entry.authorKey,
      JSON.stringify(entry.item),
      entry.createdAt
    )
    return entry
  }

  function rebuildTimeline(sessionId: string) {
    inTransaction(db, () => rebuildSession(sessionId))
  }

  function rebuildSession(sessionId: string) {
    const expired = db
      .prepare(
        `SELECT id FROM timeline_items
         WHERE session_id = ? AND status = 'expired'`
      )
      .all(sessionId)
      .map((row) => String(row.id))
    db.prepare("DELETE FROM timeline_items WHERE session_id = ?").run(sessionId)
    let timeline = emptyTimeline()
    for (const line of listLines(sessionId)) {
      if (line.direction !== "out") continue
      const step = reduceTimeline(timeline, decodeLine(line.text))
      timeline = step.state
      saveItems(sessionId, step.changes, line.seq)
    }
    for (const id of expired) expireOpenRequests.run({ id })
  }

  function migrate() {
    const version = Number(
      db.prepare("PRAGMA user_version").get()?.user_version
    )
    for (const migration of MIGRATIONS) {
      if (migration.version <= version) continue
      inTransaction(db, () => {
        db.exec(migration.sql)
        if (migration.rebuild) {
          for (const row of db.prepare("SELECT id FROM agent_sessions").all()) {
            rebuildSession(String(row.id))
          }
        }
        db.exec(`PRAGMA user_version = ${migration.version}`)
      })
    }
  }

  function listSessionTurns(
    agentId: string,
    conversationId: string,
    claudeSessionId: string
  ): TurnItem[] {
    return db
      .prepare(
        `SELECT timeline_items.payload FROM timeline_items
         JOIN agent_sessions ON agent_sessions.id = timeline_items.session_id
         WHERE agent_sessions.agent_id = ?
           AND agent_sessions.conversation_id = ?
           AND agent_sessions.claude_session_id = ?
           AND timeline_items.kind = 'turn'
         ORDER BY timeline_items.seq`
      )
      .all(agentId, conversationId, claudeSessionId)
      .map((row) => JSON.parse(String(row.payload)) as TurnItem)
  }

  function listTimeline(conversationId: string): TimelineEntry[] {
    return db
      .prepare(
        `SELECT id, seq, author_key, created_at, payload FROM timeline_items
         WHERE conversation_id = ? ORDER BY seq, rowid`
      )
      .all(conversationId)
      .map((row) => ({
        id: String(row.id),
        seq: Number(row.seq),
        authorKey: String(row.author_key),
        createdAt: String(row.created_at),
        item: JSON.parse(String(row.payload)) as TimelineItem,
      }))
  }

  return {
    createAgent,
    getAgent,
    listAgents,
    updateAgent,
    createConversation,
    getConversation,
    listConversations,
    findDirectMessage,
    createSession,
    getSession,
    latestSession,
    updateSession,
    recordLine,
    listLines,
    saveItems,
    addUserMessage,
    rebuildTimeline,
    listTimeline,
    listSessionTurns,
    close: () => db.close(),
  }
}

function inTransaction(db: DatabaseSync, work: () => void) {
  db.exec("BEGIN")
  try {
    work()
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function agentIdOf(memberKey: string): string | null {
  return memberKey.startsWith("agent:")
    ? memberKey.slice("agent:".length)
    : null
}

function toConversation(row: Row, members: string[]): Conversation {
  return {
    id: String(row.id),
    kind: String(row.kind) as Conversation["kind"],
    name: String(row.name),
    topic: row.topic === null ? null : String(row.topic),
    private: row.private === 1,
    replyMode: String(row.reply_mode) as Conversation["replyMode"],
    members,
    createdAt: String(row.created_at),
  }
}

function toAgent(row: Row): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    colour: String(row.colour),
    model: String(row.model),
    permissionMode: String(row.permission_mode),
    cwd: String(row.cwd),
    autostart: row.autostart === 1,
    allowedTools: JSON.parse(String(row.allowed_tools)) as string[],
    disallowedTools: JSON.parse(String(row.disallowed_tools)) as string[],
    systemPrompt: row.system_prompt === null ? null : String(row.system_prompt),
    createdAt: String(row.created_at),
  }
}
