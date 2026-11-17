import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { decodeLine } from "../protocol/decode.ts"
import {
  emptyTimeline,
  reduceTimeline,
  type SharedFile,
  type CompactionItem,
  type TimelineItem,
  type TurnItem,
} from "../timeline/reduce.ts"
import type {
  Agent,
  Conversation,
  NewAgent,
  LogLine,
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
  endReason: string | null
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
      displayName: agent.displayName ?? null,
      sleepAfterMinutes: agent.sleepAfterMinutes ?? null,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    db.prepare(
      `INSERT INTO agents (id, name, display_name, colour, model, permission_mode, cwd,
         autostart, allowed_tools, disallowed_tools, system_prompt, description,
         max_turns, sleep_after_minutes, created_at)
       VALUES (:id, :name, :displayName, :colour, :model, :permissionMode, :cwd,
         :autostart, :allowedTools, :disallowedTools, :systemPrompt, :description,
         :maxTurns, :sleepAfterMinutes, :createdAt)`
    ).run({
      ...agentColumns(created),
      id: created.id,
      createdAt: created.createdAt,
    })
    return created
  }

  function updateAgent(id: string, agent: NewAgent): Agent | undefined {
    db.prepare(
      `UPDATE agents SET name = :name, display_name = :displayName,
         colour = :colour, model = :model,
         permission_mode = :permissionMode, cwd = :cwd, autostart = :autostart,
         allowed_tools = :allowedTools, disallowed_tools = :disallowedTools,
         system_prompt = :systemPrompt, description = :description,
         max_turns = :maxTurns, sleep_after_minutes = :sleepAfterMinutes
       WHERE id = :id`
    ).run({ ...agentColumns(agent), id })
    return getAgent(id)
  }

  function listAgents(): Agent[] {
    return db
      .prepare(
        `SELECT * FROM agents WHERE deleted_at IS NULL
         ORDER BY COALESCE(display_name, name) COLLATE NOCASE`
      )
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
      cwd: conversation.cwd ?? null,
      sleepAfterMinutes: conversation.sleepAfterMinutes ?? null,
      rules: conversation.rules ?? null,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    db.prepare(
      `INSERT INTO conversations (id, kind, name, topic, private, reply_mode,
         cwd, sleep_after_minutes, rules, created_at)
       VALUES (:id, :kind, :name, :topic, :private, :replyMode, :cwd,
         :sleepAfterMinutes, :rules, :createdAt)`
    ).run({
      id: created.id,
      kind: created.kind,
      name: created.name,
      topic: created.topic,
      private: created.private ? 1 : 0,
      replyMode: created.replyMode,
      cwd: created.cwd,
      sleepAfterMinutes: created.sleepAfterMinutes,
      rules: created.rules,
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

  function addMember(conversationId: string, memberKey: string) {
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(position), -1) + 1 AS next
         FROM conversation_members WHERE conversation_id = ?`
      )
      .get(conversationId)
    db.prepare(
      `INSERT INTO conversation_members (conversation_id, member_key, agent_id,
         position, joined_seq)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      conversationId,
      memberKey,
      agentIdOf(memberKey),
      Number(row?.next),
      nextSeq() - 1
    )
  }

  function updateConversation(
    id: string,
    change: Partial<
      Pick<
        Conversation,
        | "name"
        | "topic"
        | "private"
        | "replyMode"
        | "cwd"
        | "sleepAfterMinutes"
        | "rules"
      >
    >
  ): Conversation | undefined {
    const current = getConversation(id)
    if (!current) return undefined
    const next = { ...current, ...change }
    db.prepare(
      `UPDATE conversations SET name = :name, topic = :topic, private = :private,
         reply_mode = :replyMode, cwd = :cwd,
         sleep_after_minutes = :sleepAfterMinutes, rules = :rules
       WHERE id = :id`
    ).run({
      id,
      name: next.name,
      topic: next.topic,
      private: next.private ? 1 : 0,
      replyMode: next.replyMode,
      cwd: next.cwd,
      sleepAfterMinutes: next.sleepAfterMinutes ?? null,
      rules: next.rules ?? null,
    })
    return getConversation(id)
  }

  function removeMember(conversationId: string, memberKey: string) {
    db.prepare(
      `DELETE FROM conversation_members
       WHERE conversation_id = ? AND member_key = ?`
    ).run(conversationId, memberKey)
  }

  function listAuthorKeys(conversationId: string): string[] {
    return db
      .prepare(
        `SELECT DISTINCT author_key FROM timeline_items
         WHERE conversation_id = ? ORDER BY author_key`
      )
      .all(conversationId)
      .map((row) => String(row.author_key))
  }

  function deleteConversation(id: string) {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id)
  }

  function deleteAgent(id: string) {
    const memberKey = `agent:${id}`
    const deletedConversationIds: string[] = []
    const changedConversationIds: string[] = []
    inTransaction(db, () => {
      const memberships = db
        .prepare(
          `SELECT c.id, c.kind,
             (SELECT COUNT(*) FROM conversation_members o
              WHERE o.conversation_id = c.id AND o.agent_id IS NOT NULL
                AND o.member_key != :memberKey) AS other_agents
           FROM conversations c
           JOIN conversation_members m ON m.conversation_id = c.id
           WHERE m.member_key = :memberKey
           ORDER BY c.created_at, c.rowid`
        )
        .all({ memberKey })
      for (const row of memberships) {
        const conversationId = String(row.id)
        const alone = row.kind === "group" && Number(row.other_agents) === 0
        if (row.kind === "dm" || alone) {
          deleteConversation(conversationId)
          deletedConversationIds.push(conversationId)
        } else {
          removeMember(conversationId, memberKey)
          changedConversationIds.push(conversationId)
        }
      }
      db.prepare("UPDATE agents SET deleted_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id
      )
    })
    return { deletedConversationIds, changedConversationIds }
  }

  function joinedSeq(conversationId: string, memberKey: string): number {
    const row = db
      .prepare(
        `SELECT joined_seq FROM conversation_members
         WHERE conversation_id = ? AND member_key = ?`
      )
      .get(conversationId, memberKey)
    return Number(row?.joined_seq ?? 0)
  }

  function listConversations(): Conversation[] {
    return db
      .prepare("SELECT id FROM conversations ORDER BY created_at, rowid")
      .all()
      .flatMap((row) => getConversation(String(row.id)) ?? [])
  }

  function markRead(conversationId: string, seq: number) {
    db.prepare(
      `INSERT INTO conversation_reads (conversation_id, last_read_seq, read_at)
       VALUES (:conversationId, :seq, :readAt)
       ON CONFLICT (conversation_id) DO UPDATE SET
         last_read_seq = max(last_read_seq, excluded.last_read_seq),
         read_at = excluded.read_at`
    ).run({ conversationId, seq, readAt: new Date().toISOString() })
  }

  function unreadCounts(): Record<string, number> {
    const rows = db
      .prepare(
        `SELECT timeline_items.conversation_id AS id, count(*) AS unread
         FROM timeline_items
         LEFT JOIN conversation_reads
           ON conversation_reads.conversation_id = timeline_items.conversation_id
         WHERE timeline_items.author_key LIKE 'agent:%'
           AND timeline_items.kind IN ('message', 'notice', 'permission', 'question')
           AND timeline_items.seq > coalesce(conversation_reads.last_read_seq, 0)
         GROUP BY timeline_items.conversation_id`
      )
      .all()
    return Object.fromEntries(
      rows.map((row) => [String(row.id), Number(row.unread)])
    )
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
      endReason: null,
    }
    db.prepare(
      `INSERT INTO agent_sessions (id, agent_id, conversation_id,
         claude_session_id, claude_session_new, config, state, started_at,
         ended_at, exit_code, stderr, end_reason)
       VALUES (:id, :agentId, :conversationId, :claudeSessionId,
         :claudeSessionNew, :config, :state, :startedAt, :endedAt, :exitCode,
         :stderr, :endReason)`
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
          : configWithLimit(JSON.parse(String(row.config)) as SessionConfig),
      state: String(row.state),
      startedAt: String(row.started_at),
      endedAt: row.ended_at === null ? null : String(row.ended_at),
      exitCode: row.exit_code === null ? null : Number(row.exit_code),
      stderr: row.stderr === null ? null : String(row.stderr),
      endReason: row.end_reason === null ? null : String(row.end_reason),
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
        | "endReason"
      >
    >
  ) {
    const current = getSession(id)
    if (!current) return
    const next = { ...current, ...change }
    db.prepare(
      `UPDATE agent_sessions SET claude_session_id = :claudeSessionId,
         claude_session_new = :claudeSessionNew, state = :state, ended_at = :endedAt, exit_code = :exitCode,
         stderr = :stderr, end_reason = :endReason
       WHERE id = :id`
    ).run({
      id,
      claudeSessionId: next.claudeSessionId,
      claudeSessionNew: next.claudeSessionNew ? 1 : 0,
      state: next.state,
      endedAt: next.endedAt,
      exitCode: next.exitCode,
      stderr: next.stderr,
      endReason: next.endReason,
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

  function addUserMessage(
    conversationId: string,
    text: string,
    files: SharedFile[] = []
  ): TimelineEntry {
    return addMessage(conversationId, "user:me", text, files)
  }

  function addMessage(
    conversationId: string,
    authorKey: string,
    text: string,
    files: SharedFile[] = []
  ): TimelineEntry {
    const id = randomUUID()
    const entry: TimelineEntry = {
      id,
      seq: nextSeq(),
      authorKey,
      createdAt: new Date().toISOString(),
      item: {
        kind: "message",
        id,
        text,
        status: "done",
        ...(files.length > 0 ? { files } : {}),
      },
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

  function shareFiles(
    conversationId: string,
    itemId: string,
    files: SharedFile[],
    sharedBy: string
  ) {
    const sharedAt = new Date().toISOString()
    const upsert = db.prepare(
      `INSERT INTO shared_files (id, conversation_id, item_id, name, path, kind,
         size, shared_by, shared_at)
       VALUES (:id, :conversationId, :itemId, :name, :path, :kind, :size,
         :sharedBy, :sharedAt)
       ON CONFLICT (conversation_id, path) DO UPDATE SET item_id = :itemId,
         name = :name, kind = :kind, size = :size, shared_by = :sharedBy,
         shared_at = :sharedAt, removed_at = NULL, removed_by = NULL`
    )
    for (const file of files) {
      upsert.run({
        id: randomUUID(),
        conversationId,
        itemId,
        name: file.name,
        path: file.path,
        kind: file.kind,
        size: file.size,
        sharedBy,
        sharedAt,
      })
    }
  }

  function listSharedFiles(conversationId: string): SharedFileRow[] {
    return db
      .prepare(
        "SELECT * FROM shared_files WHERE conversation_id = ? ORDER BY shared_at DESC, name"
      )
      .all(conversationId)
      .map((row) => toSharedFile(row as Row))
  }

  function getSharedFile(id: string): SharedFileRow | undefined {
    const row = db.prepare("SELECT * FROM shared_files WHERE id = ?").get(id)
    return row ? toSharedFile(row as Row) : undefined
  }

  function removeSharedFile(id: string, removedBy: string) {
    db.prepare(
      `UPDATE shared_files SET removed_at = ?, removed_by = ?
       WHERE id = ? AND removed_at IS NULL`
    ).run(new Date().toISOString(), removedBy, id)
    return getSharedFile(id)
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
      if (migration.foreignKeysOff) db.exec("PRAGMA foreign_keys = OFF")
      try {
        inTransaction(db, () => {
          db.exec(migration.sql)
          migration.run?.(db)
          if (migration.rebuild) {
            for (const row of db
              .prepare("SELECT id FROM agent_sessions")
              .all()) {
              rebuildSession(String(row.id))
            }
          }
          if (db.prepare("PRAGMA foreign_key_check").all().length > 0) {
            throw new Error(
              `Migration ${migration.version} breaks a foreign key.`
            )
          }
          db.exec(`PRAGMA user_version = ${migration.version}`)
        })
      } finally {
        if (migration.foreignKeysOff) db.exec("PRAGMA foreign_keys = ON")
      }
    }
  }

  function listAgentLines(
    agentId: string,
    conversationId: string,
    page: { limit: number; before?: number }
  ): LogLine[] {
    return db
      .prepare(
        `SELECT session_events.seq, session_events.session_id,
           session_events.direction, session_events.line, session_events.at
         FROM session_events
         JOIN agent_sessions ON agent_sessions.id = session_events.session_id
         WHERE agent_sessions.agent_id = ? AND agent_sessions.conversation_id = ?
           AND session_events.seq < ?
         ORDER BY session_events.seq DESC LIMIT ?`
      )
      .all(
        agentId,
        conversationId,
        page.before ?? Number.MAX_SAFE_INTEGER,
        page.limit
      )
      .map((row) => ({
        seq: Number(row.seq),
        sessionId: String(row.session_id),
        direction: String(row.direction) as LogLine["direction"],
        at: String(row.at),
        text: String(row.line),
      }))
      .reverse()
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

  function lastCompaction(
    agentId: string,
    conversationId: string,
    claudeSessionId: string
  ): { createdAt: string; item: CompactionItem } | undefined {
    return db
      .prepare(
        `SELECT timeline_items.created_at, timeline_items.payload
         FROM timeline_items
         JOIN agent_sessions ON agent_sessions.id = timeline_items.session_id
         WHERE agent_sessions.agent_id = ?
           AND agent_sessions.conversation_id = ?
           AND agent_sessions.claude_session_id = ?
           AND timeline_items.kind = 'compaction'
         ORDER BY timeline_items.seq`
      )
      .all(agentId, conversationId, claudeSessionId)
      .map((row) => ({
        createdAt: String(row.created_at),
        item: JSON.parse(String(row.payload)) as CompactionItem,
      }))
      .filter(({ item }) => item.status === "done")
      .at(-1)
  }

  function latestSummary(
    conversationId: string
  ): { throughSeq: number; text: string } | undefined {
    const row = db
      .prepare(
        `SELECT through_seq, text FROM conversation_summaries
         WHERE conversation_id = ? ORDER BY through_seq DESC LIMIT 1`
      )
      .get(conversationId)
    return row
      ? { throughSeq: Number(row.through_seq), text: String(row.text) }
      : undefined
  }

  function saveSummary(summary: {
    conversationId: string
    throughSeq: number
    text: string
    costUsd: number
  }) {
    db.prepare(
      `INSERT OR REPLACE INTO conversation_summaries
         (conversation_id, through_seq, text, cost_usd, created_at)
       VALUES (:conversationId, :throughSeq, :text, :costUsd, :createdAt)`
    ).run({ ...summary, createdAt: new Date().toISOString() })
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
    addMessage,
    listConversations,
    unreadCounts,
    markRead,
    addMember,
    updateConversation,
    shareFiles,
    listSharedFiles,
    getSharedFile,
    removeSharedFile,
    removeMember,
    deleteConversation,
    listAuthorKeys,
    deleteAgent,
    joinedSeq,
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
    lastCompaction,
    latestSummary,
    saveSummary,
    listAgentLines,
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
    cwd: row.cwd === null ? null : String(row.cwd),
    sleepAfterMinutes:
      row.sleep_after_minutes === null ? null : Number(row.sleep_after_minutes),
    rules: row.rules === null ? null : String(row.rules),
    members,
    createdAt: String(row.created_at),
  }
}

function agentColumns(agent: NewAgent) {
  return {
    name: agent.name,
    displayName: agent.displayName ?? null,
    colour: agent.colour,
    model: agent.model,
    permissionMode: agent.permissionMode,
    cwd: agent.cwd,
    autostart: agent.autostart ? 1 : 0,
    allowedTools: JSON.stringify(agent.allowedTools),
    disallowedTools: JSON.stringify(agent.disallowedTools),
    systemPrompt: agent.systemPrompt,
    description: agent.description,
    maxTurns: agent.maxTurns,
    sleepAfterMinutes: agent.sleepAfterMinutes ?? null,
  }
}

function toAgent(row: Row): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    displayName: row.display_name === null ? null : String(row.display_name),
    colour: String(row.colour),
    model: String(row.model),
    permissionMode: String(row.permission_mode),
    cwd: row.cwd === null ? null : String(row.cwd),
    autostart: row.autostart === 1,
    allowedTools: JSON.parse(String(row.allowed_tools)) as string[],
    disallowedTools: JSON.parse(String(row.disallowed_tools)) as string[],
    systemPrompt: row.system_prompt === null ? null : String(row.system_prompt),
    description: row.description === null ? null : String(row.description),
    maxTurns: row.max_turns === null ? null : Number(row.max_turns),
    sleepAfterMinutes:
      row.sleep_after_minutes === null ? null : Number(row.sleep_after_minutes),
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at === null ? null : String(row.deleted_at),
  }
}

function configWithLimit(config: SessionConfig): SessionConfig {
  return { ...config, maxTurns: config.maxTurns ?? null }
}

export type SharedFileRow = SharedFile & {
  id: string
  conversationId: string
  itemId: string | null
  sharedBy: string
  sharedAt: string
  removedAt: string | null
  removedBy: string | null
}

function toSharedFile(row: Row): SharedFileRow {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    itemId: row.item_id === null ? null : String(row.item_id),
    name: String(row.name),
    path: String(row.path),
    kind: String(row.kind) as SharedFile["kind"],
    size: Number(row.size),
    sharedBy: String(row.shared_by),
    sharedAt: String(row.shared_at),
    removedAt: row.removed_at === null ? null : String(row.removed_at),
    removedBy: row.removed_by === null ? null : String(row.removed_by),
  }
}
