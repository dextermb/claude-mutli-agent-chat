import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { decodeLine } from "../protocol/decode.ts"
import {
  emptyTimeline,
  reduceTimeline,
  type TimelineItem,
} from "../timeline/reduce.ts"
import { SCHEMA } from "./schema.ts"

export type Agent = {
  id: string
  name: string
  colour: string
  model: string
  permissionMode: string
  cwd: string
  autostart: boolean
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
  createdAt: string
}

export type NewAgent = Omit<Agent, "id" | "createdAt">

export type Conversation = {
  id: string
  kind: "channel" | "group" | "dm"
  name: string
  topic: string | null
  private: boolean
  replyMode: "mention" | "every"
  members: string[]
  createdAt: string
}

export type NewConversation = Omit<Conversation, "id" | "createdAt">

export type SessionRow = {
  id: string
  agentId: string
  conversationId: string
  claudeSessionId: string | null
  state: string
  startedAt: string
}

export type StoredLine = {
  seq: number
  direction: "in" | "out"
  text: string
}

export type TimelineEntry = {
  id: string
  seq: number
  authorKey: string
  item: TimelineItem
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
  }): SessionRow {
    const created: SessionRow = {
      agentId: session.agentId,
      conversationId: session.conversationId,
      id: randomUUID(),
      claudeSessionId: session.claudeSessionId ?? null,
      state: "starting",
      startedAt: new Date().toISOString(),
    }
    db.prepare(
      `INSERT INTO agent_sessions (id, agent_id, conversation_id,
         claude_session_id, state, started_at)
       VALUES (:id, :agentId, :conversationId, :claudeSessionId, :state,
         :startedAt)`
    ).run(created)
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
      state: String(row.state),
      startedAt: String(row.started_at),
    }
  }

  function updateSession(
    id: string,
    change: Partial<Pick<SessionRow, "claudeSessionId" | "state">>
  ) {
    const current = getSession(id)
    if (!current) return
    db.prepare(
      `UPDATE agent_sessions SET claude_session_id = ?, state = ? WHERE id = ?`
    ).run(
      change.claudeSessionId ?? current.claudeSessionId,
      change.state ?? current.state,
      id
    )
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
    seq: number
  ): TimelineEntry[] {
    const session = db
      .prepare(
        "SELECT agent_id, conversation_id FROM agent_sessions WHERE id = ?"
      )
      .get(sessionId)
    if (!session) return []
    const save = db.prepare(
      `INSERT INTO timeline_items (id, conversation_id, seq, session_id,
         author_key, kind, tool_use_id, status, payload, created_at)
       VALUES (:id, :conversationId, :seq, :sessionId, :authorKey, :kind,
         :toolUseId, :status, :payload, :createdAt)
       ON CONFLICT (id) DO UPDATE SET
         status = excluded.status,
         payload = excluded.payload
       RETURNING id, seq, author_key`
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
        createdAt: new Date().toISOString(),
      })
      return {
        id: String(row?.id),
        seq: Number(row?.seq),
        authorKey: String(row?.author_key),
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
      new Date().toISOString()
    )
    return entry
  }

  function rebuildTimeline(sessionId: string) {
    db.exec("BEGIN")
    try {
      const expired = db
        .prepare(
          `SELECT id FROM timeline_items
           WHERE session_id = ? AND status = 'expired'`
        )
        .all(sessionId)
        .map((row) => String(row.id))
      db.prepare("DELETE FROM timeline_items WHERE session_id = ?").run(
        sessionId
      )
      let timeline = emptyTimeline()
      for (const line of listLines(sessionId)) {
        if (line.direction !== "out") continue
        const step = reduceTimeline(timeline, decodeLine(line.text))
        timeline = step.state
        saveItems(sessionId, step.changes, line.seq)
      }
      for (const id of expired) expireOpenRequests.run({ id })
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  }

  function listTimeline(conversationId: string): TimelineEntry[] {
    return db
      .prepare(
        `SELECT id, seq, author_key, payload FROM timeline_items
         WHERE conversation_id = ? ORDER BY seq, rowid`
      )
      .all(conversationId)
      .map((row) => ({
        id: String(row.id),
        seq: Number(row.seq),
        authorKey: String(row.author_key),
        item: JSON.parse(String(row.payload)) as TimelineItem,
      }))
  }

  return {
    createAgent,
    getAgent,
    createConversation,
    getConversation,
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
    close: () => db.close(),
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
