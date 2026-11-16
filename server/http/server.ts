import { rm } from "node:fs/promises"
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import type { AddressInfo } from "node:net"
import type { PermissionAnswer } from "../protocol/encode.ts"
import { parseMentions } from "../conversation/mentions.ts"
import {
  agentSchema,
  channelSchema,
  channelSettingsSchema,
  checkBody,
} from "../schemas.ts"
import { defaultScratchRoot, homeShort } from "../paths.ts"
import { buildArgs } from "../session/args.ts"
import { COMPACT_PROMPT } from "../session/compact-prompt.ts"
import type { Summarize } from "../summary/summarizer.ts"
import {
  ENVIRONMENT_RULE,
  factsNote,
  sessionFacts,
} from "../session/environment-prompt.ts"
import { answerRpc } from "../mcp/rpc.ts"
import { chatTools, type ChatServer } from "../mcp/tools.ts"
import { findFile } from "./find-file.ts"
import { folderError, listFolders } from "./folders.ts"
import { searchPaths } from "./paths.ts"
import { checkFiles, isFile, sharedFileLines } from "./shared-files.ts"
import { saveUpload, UPLOAD_LIMIT, uploadsOf } from "./uploads.ts"
import type { PermissionItem, QuestionItem } from "../timeline/reduce.ts"
import type { SessionEvent, SessionState } from "../session/session.ts"
import type { Agent, Conversation, SessionRow, Store } from "../store/store.ts"
import type {
  SessionCard,
  SessionConfig,
  SharedFileView,
  TimelineEntry,
} from "../api-types.ts"

export type SessionHandle = {
  prompt(text: string, note?: string): void
  answer(requestId: string, answer: PermissionAnswer): void
  interrupt(): void
  stop(): Promise<void>
}

export type StartSession = (options: {
  agent: Agent
  args: string[]
  cwd: string
  onEvent: (event: SessionEvent) => void
}) => SessionHandle

export type ServerOptions = {
  store: Store
  startSession: StartSession
  uploadsFolder: string
  uploadLimit?: number
  eventLogSize?: number
  scratchRoot?: string
  sleepAfterMinutes?: number
  compactAboveTokens?: number
  minuteMs?: number
  wakeMessages?: number
  summarize?: Summarize
}

type QueuedPrompt = {
  text: string
  note: string | null
  ready: boolean
  omittedThrough: number | null
}

type LiveSession = {
  id: string
  agentId: string
  conversationId: string
  handle: SessionHandle | null
  token: string
  state: SessionState
  queue: QueuedPrompt[]
  cwd: string
  facts: string[] | null
  sleepTimer: ReturnType<typeof setTimeout> | null
  compactingForSleep: boolean
  contextTokens: number
  runningJobs: Set<string>
  asleepForMs: number | null
  restartNote: string | null
  lastOutSeq: number
  exit: { code: number | null; stderr: string } | null
}

type StreamEvent = { id: number; data: string }

type Channel = {
  nextId: number
  log: StreamEvent[]
  clients: Set<ServerResponse>
}

const URGENCY: SessionState[] = [
  "waiting",
  "busy",
  "starting",
  "failed",
  "idle",
  "exited",
]

const QUESTION_MARK = /\?[*_~]*(?=\s|$)/u

const HOST = "127.0.0.1"
const MAX_BODY_BYTES = 1_000_000
const EVENT_LOG_SIZE = 500
const LOG_PAGE = 200
const SUMMARY_HEADING = "\nSummary:\n"
const NO_TRANSCRIPT = "No conversation found with session ID"
const SLEEP_AFTER_MINUTES = 15
const COMPACT_ABOVE_TOKENS = 100_000
const WAKE_MESSAGES = 30
const SUMMARY_MESSAGES = 400
const MINUTE_MS = 60_000

export function createServer({
  store,
  startSession,
  uploadsFolder,
  uploadLimit = UPLOAD_LIMIT,
  eventLogSize = EVENT_LOG_SIZE,
  scratchRoot = defaultScratchRoot(),
  sleepAfterMinutes = SLEEP_AFTER_MINUTES,
  compactAboveTokens = COMPACT_ABOVE_TOKENS,
  minuteMs = MINUTE_MS,
  wakeMessages = WAKE_MESSAGES,
  summarize,
}: ServerOptions) {
  const live = new Map<string, LiveSession>()
  const channels = new Map<string, Channel>()
  const appChannel: Channel = { nextId: 1, log: [], clients: new Set() }
  const sentAgentStates = new Map<string, SessionState>()
  const sentUnread = new Map<string, number>()
  const promptCursors = new Map<string, number>()
  const removedNotes = new Map<string, string[]>()
  const summaryRuns = new Map<string, Promise<string | null>>()
  const tokens = new Map<string, LiveSession>()
  let chatUrl = ""
  const openRequests = new Map<
    string,
    { session: LiveSession; card: PermissionItem | QuestionItem }
  >()

  function channelOf(conversationId: string): Channel {
    let channel = channels.get(conversationId)
    if (!channel) {
      channel = { nextId: 1, log: [], clients: new Set() }
      channels.set(conversationId, channel)
    }
    return channel
  }

  function publish(conversationId: string, data: unknown) {
    publishTo(channelOf(conversationId), data)
  }

  function sendLive(conversationId: string, data: unknown) {
    const text = `data: ${JSON.stringify(data)}\n\n`
    for (const client of channelOf(conversationId).clients) client.write(text)
  }

  function publishTo(channel: Channel, data: unknown) {
    const event = { id: channel.nextId, data: JSON.stringify(data) }
    channel.nextId += 1
    channel.log.push(event)
    if (channel.log.length > eventLogSize) channel.log.shift()
    for (const client of channel.clients) writeEvent(client, event)
  }

  function publishUnread(conversationId: string) {
    const count = store.unreadCounts()[conversationId] ?? 0
    if ((sentUnread.get(conversationId) ?? 0) === count) return
    sentUnread.set(conversationId, count)
    publishTo(appChannel, { type: "unread", conversationId, count })
  }

  function findLive(agentId: string, conversationId: string) {
    for (const session of live.values()) {
      if (
        session.agentId === agentId &&
        session.conversationId === conversationId
      ) {
        return session
      }
    }
    return undefined
  }

  function liveSessionFor(agentId: string, conversationId: string) {
    const running = findLive(agentId, conversationId)
    if (running) return running
    const earlier = store.latestSession(agentId, conversationId)
    const agent = store.getAgent(agentId)
    const conversation = store.getConversation(conversationId)
    if (!agent || !conversation) return undefined
    const session = start(
      store.createSession({
        agentId,
        conversationId,
        claudeSessionId: earlier?.claudeSessionId,
        claudeSessionNew: earlier?.claudeSessionNew,
        config: configOf(agent, folderFor(agent, conversation)),
      })
    )
    if (session && earlier?.endReason === "sleep" && earlier.endedAt) {
      session.asleepForMs = Date.now() - Date.parse(earlier.endedAt)
    }
    return session
  }

  function folderFor(agent: Agent, conversation: Conversation): string {
    return conversation.cwd ?? agent.cwd ?? scratchFolder(conversation.id)
  }

  function sessionCwd(agent: Agent, conversation: Conversation): string {
    return (
      store.latestSession(agent.id, conversation.id)?.config?.cwd ??
      folderFor(agent, conversation)
    )
  }

  function folderSource(
    cwd: string,
    conversation: Conversation
  ): "channel" | "agent" | "scratch" {
    if (cwd === conversation.cwd) return "channel"
    if (cwd === scratchFolder(conversation.id)) return "scratch"
    return "agent"
  }

  function scratchFolder(conversationId: string): string {
    return join(scratchRoot, conversationId)
  }

  function start(row: SessionRow): LiveSession | undefined {
    const agent = store.getAgent(row.agentId)
    const conversation = store.getConversation(row.conversationId)
    if (!agent || !conversation) return undefined
    const cwd = row.config?.cwd ?? folderFor(agent, conversation)
    const session: LiveSession = {
      id: row.id,
      agentId: row.agentId,
      conversationId: row.conversationId,
      handle: null,
      token: randomUUID(),
      state: "starting",
      queue: [],
      cwd,
      facts: null,
      sleepTimer: null,
      compactingForSleep: false,
      contextTokens: 0,
      runningJobs: new Set(),
      asleepForMs: null,
      restartNote: null,
      lastOutSeq: 0,
      exit: null,
    }
    live.set(session.id, session)
    tokens.set(session.token, session)
    if (cwd === scratchFolder(conversation.id)) {
      mkdirSync(cwd, { recursive: true })
    }
    const uploads = uploadsOf(uploadsFolder, row.conversationId)
    mkdirSync(uploads, { recursive: true })
    session.handle = startSession({
      agent,
      args: buildArgs(agent, row, {
        rule: ENVIRONMENT_RULE,
        chat: { url: chatUrl, token: session.token },
        uploads,
      }),
      cwd,
      onEvent: (event) => onSessionEvent(session, event),
    })
    return session
  }

  function onSessionEvent(session: LiveSession, event: SessionEvent) {
    if (event.type === "line") {
      const seq = store.recordLine(session.id, event.direction, event.text)
      if (event.direction === "out") session.lastOutSeq = seq
      sendLive(session.conversationId, {
        type: "line",
        agentId: session.agentId,
        line: {
          seq,
          sessionId: session.id,
          direction: event.direction,
          at: new Date().toISOString(),
          text: event.text,
        },
      })
    }
    if (event.type === "changes") {
      const entries = store.saveItems(
        session.id,
        event.items,
        session.lastOutSeq
      )
      if (entries.length > 0) publishUnread(session.conversationId)
      for (const entry of entries) {
        if (entry.item.kind === "turn" && entry.item.context) {
          session.contextTokens = entry.item.context.used
        }
        publish(session.conversationId, { type: "item", entry })
        if (entry.item.kind === "message" && entry.item.status === "done") {
          for (const agentId of mentionedAgents(
            session.conversationId,
            entry.item.text,
            session.agentId
          )) {
            prompt(agentId, session.conversationId, entry.item.text)
          }
        }
      }
      for (const item of event.items) {
        if (item.kind === "tool_call" && item.job) {
          if (item.job.status === "running") session.runningJobs.add(item.id)
          else session.runningJobs.delete(item.id)
        }
        if (item.kind !== "permission" && item.kind !== "question") continue
        if (item.status === "pending") {
          openRequests.set(item.requestId, { session, card: item })
        } else {
          openRequests.delete(item.requestId)
        }
      }
    }
    if (event.type === "exit") {
      session.exit = { code: event.code, stderr: event.stderr }
      store.updateSession(session.id, {
        endedAt: new Date().toISOString(),
        exitCode: event.code,
        stderr: event.stderr === "" ? null : event.stderr,
      })
    }
    if (event.type === "claude_session") {
      store.updateSession(session.id, {
        claudeSessionId: event.claudeSessionId,
        claudeSessionNew: false,
      })
    }
    if (event.type === "state") {
      session.state = event.state
      if (event.state !== "idle") clearSleep(session)
      store.updateSession(session.id, { state: event.state })
      publish(session.conversationId, {
        type: "agent_state",
        agentId: session.agentId,
        state: event.state,
      })
      if (event.state === "exited" || event.state === "failed") {
        live.delete(session.id)
        tokens.delete(session.token)
      }
      publishAgentState(session.agentId)
      if (event.state === "idle") {
        deliverNext(session)
        if (session.state !== "idle") session.compactingForSleep = false
        else if (session.compactingForSleep) stopAsleep(session)
        else armSleep(session)
      }
      if (event.state === "failed") {
        if (transcriptGone(session)) startAgain(session)
        else addFailedNotice(session)
      }
    }
  }

  function armSleep(session: LiveSession) {
    const minutes = sleepMinutes(session)
    clearSleep(session)
    if (minutes === 0) return
    session.sleepTimer = setTimeout(() => {
      session.sleepTimer = null
      fallAsleep(session)
    }, minutes * minuteMs)
  }

  function clearSleep(session: LiveSession) {
    if (session.sleepTimer) clearTimeout(session.sleepTimer)
    session.sleepTimer = null
  }

  function sleepMinutes(session: LiveSession): number {
    const conversation = store.getConversation(session.conversationId)
    const agent = store.getAgent(session.agentId)
    return (
      conversation?.sleepAfterMinutes ??
      agent?.sleepAfterMinutes ??
      sleepAfterMinutes
    )
  }

  function fallAsleep(session: LiveSession) {
    if (session.state !== "idle" || session.queue.length > 0) return
    if (session.runningJobs.size > 0) return
    if (session.contextTokens >= compactAboveTokens) {
      session.compactingForSleep = true
      session.handle?.prompt(COMPACT_PROMPT)
      return
    }
    stopAsleep(session)
  }

  function stopAsleep(session: LiveSession) {
    session.compactingForSleep = false
    store.updateSession(session.id, { endReason: "sleep" })
    void session.handle?.stop()
  }

  function publishAgentState(agentId: string) {
    const state = agentState(agentId)
    if (state === (sentAgentStates.get(agentId) ?? "exited")) return
    sentAgentStates.set(agentId, state)
    publishTo(appChannel, { type: "agent_state", agentId, state })
  }

  function created(response: ServerResponse, conversation: Conversation) {
    publishTo(appChannel, { type: "conversation", conversation })
    send(response, 201, { conversation })
  }

  function sessionCard(agent: Agent, conversation: Conversation): SessionCard {
    const conversationId = conversation.id
    const now = configOf(agent, folderFor(agent, conversation))
    const row = store.latestSession(agent.id, conversationId)
    const config = row?.config ?? now
    const turns = row?.claudeSessionId
      ? store.listSessionTurns(agent.id, conversationId, row.claudeSessionId)
      : []
    const compaction = row?.claudeSessionId
      ? store.lastCompaction(agent.id, conversationId, row.claudeSessionId)
      : undefined
    return {
      claudeSessionId: row?.claudeSessionId ?? null,
      state: liveState(agent.id, conversationId),
      model: config.model,
      permissionMode: config.permissionMode,
      directory: homeShort(config.cwd),
      allowedTools: config.allowedTools,
      turns: turns.reduce((sum, turn) => sum + turn.numTurns, 0),
      costUsd: turns.reduce((sum, turn) => sum + turn.costUsd, 0),
      context: turns.at(-1)?.context ?? null,
      asleepSince:
        !findLive(agent.id, conversationId) && row?.endReason === "sleep"
          ? row.endedAt
          : null,
      lastCompaction: compaction
        ? {
            at: compaction.createdAt,
            preTokens: compaction.item.preTokens ?? 0,
            postTokens: compaction.item.postTokens ?? 0,
            summary: summaryPart(compaction.item.summary ?? ""),
          }
        : null,
      configChanged: JSON.stringify(config) !== JSON.stringify(now),
    }
  }

  function membersChanged(conversationId: string): Conversation | undefined {
    const before = store.getConversation(conversationId)
    if (before?.kind === "group") {
      store.updateConversation(conversationId, {
        name: agentIdsOf(conversationId)
          .flatMap((agentId) => store.getAgent(agentId)?.name ?? [])
          .join(", "),
      })
    }
    const conversation = store.getConversation(conversationId)
    if (conversation) announce(conversation)
    return conversation
  }

  function announce(conversation: Conversation) {
    const event = { type: "conversation", conversation }
    publish(conversation.id, event)
    publishTo(appChannel, event)
  }

  async function stopAgent(agentId: string): Promise<string[]> {
    const running = [...live.values()].filter(
      (session) => session.agentId === agentId
    )
    for (const session of running) stopTurn(session)
    await Promise.all(running.map((session) => session.handle?.stop()))
    return running.map((session) => session.conversationId)
  }

  function agentFoldersOf(
    conversationId: string
  ): { agentId: string; cwd: string }[] {
    const conversation = store.getConversation(conversationId)
    if (!conversation) return []
    return agentIdsOf(conversationId).flatMap((agentId) => {
      const agent = store.getAgent(agentId)
      return agent ? [{ agentId, cwd: sessionCwd(agent, conversation) }] : []
    })
  }

  function sharedFilesOf(conversationId: string): SharedFileView[] {
    return store.listSharedFiles(conversationId).map((file) => ({
      id: file.id,
      name: file.name,
      path: file.path,
      kind: file.kind,
      size: file.size,
      sharedBy: authorName(file.sharedBy),
      sharedAt: file.sharedAt,
      removedAt: file.removedAt,
      exists: isFile(file.path),
    }))
  }

  function stopTurn(session: LiveSession) {
    session.queue = []
    if (session.state === "busy" || session.state === "waiting") {
      session.handle?.interrupt()
    }
  }

  function transcriptGone(session: LiveSession): boolean {
    const row = store.getSession(session.id)
    return (
      row?.claudeSessionId !== null &&
      row?.claudeSessionNew === false &&
      (session.exit?.stderr ?? "").includes(NO_TRANSCRIPT)
    )
  }

  function startAgain(gone: LiveSession) {
    const agent = store.getAgent(gone.agentId)
    const conversation = store.getConversation(gone.conversationId)
    const earlier = store.getSession(gone.id)
    if (!agent || !conversation || !earlier?.claudeSessionId) return
    const kept = store.lastCompaction(
      agent.id,
      conversation.id,
      earlier.claudeSessionId
    )
    const row = store.createSession({
      agentId: agent.id,
      conversationId: conversation.id,
      claudeSessionId: randomUUID(),
      claudeSessionNew: true,
      config: configOf(agent, folderFor(agent, conversation)),
    })
    const [entry] = store.saveItems(row.id, [
      {
        kind: "session_start",
        id: "start",
        status: "done",
        claudeSessionId: row.claudeSessionId ?? "",
      },
    ])
    if (entry) publish(conversation.id, { type: "item", entry })
    const session = start(row)
    if (!session) return
    session.queue = gone.queue
    session.asleepForMs = gone.asleepForMs
    session.restartNote = [
      "[Chat app] Claude Code deleted the transcript of your earlier session, so this is a new session. Use read_messages for the earlier messages of this conversation.",
      ...(kept?.item.summary
        ? [
            "[Chat app] The summary that you kept in your earlier session:",
            summaryPart(kept.item.summary),
          ]
        : []),
    ].join("\n")
  }

  function addFailedNotice(session: LiveSession) {
    const [entry] = store.saveItems(session.id, [
      {
        kind: "notice",
        id: "exit",
        reason: "failed",
        status: "failed",
        exitCode: session.exit?.code ?? null,
        stderr: session.exit?.stderr ?? "",
      },
    ])
    if (entry) publish(session.conversationId, { type: "item", entry })
    publishUnread(session.conversationId)
  }

  function agentState(agentId: string): SessionState {
    let state: SessionState = "exited"
    for (const session of live.values()) {
      if (session.agentId !== agentId) continue
      if (URGENCY.indexOf(session.state) < URGENCY.indexOf(state)) {
        state = session.state
      }
    }
    return state
  }

  function liveState(agentId: string, conversationId: string): SessionState {
    return findLive(agentId, conversationId)?.state ?? "exited"
  }

  function deliver(session: LiveSession, queued: QueuedPrompt) {
    session.queue.push(queued)
    deliverNext(session)
  }

  function deliverNext(session: LiveSession) {
    if (session.state !== "idle") return
    if (session.queue[0]?.ready === false) return
    const queued = session.queue.shift()
    if (queued === undefined) return
    const facts = factsOf(session)
    const notes = [
      gapNote(session.asleepForMs),
      session.restartNote,
      facts ? factsNote(session.facts, facts) : undefined,
      queued.note,
    ].filter((note) => note !== undefined && note !== null)
    if (facts) session.facts = facts
    session.asleepForMs = null
    session.restartNote = null
    session.handle?.prompt(
      queued.text,
      notes.length > 0 ? notes.join("\n") : undefined
    )
  }

  function factsOf(session: LiveSession): string[] | undefined {
    const agent = store.getAgent(session.agentId)
    const conversation = store.getConversation(session.conversationId)
    if (!agent || !conversation) return undefined
    return sessionFacts({
      agentName: agent.name,
      conversation,
      memberNames: conversation.members.map(authorName),
      folder: {
        path: homeShort(session.cwd),
        from: folderSource(session.cwd, conversation),
      },
    })
  }

  function promptFor(
    agentId: string,
    conversationId: string,
    text: string
  ): QueuedPrompt {
    if (store.getConversation(conversationId)?.kind === "dm") {
      return { text, note: null, ready: true, omittedThrough: null }
    }
    const author = `agent:${agentId}`
    const entries = store.listTimeline(conversationId)
    const key = `${agentId} ${conversationId}`
    const cursor =
      promptCursors.get(key) ??
      Math.max(
        store.joinedSeq(conversationId, author),
        ...entries
          .filter((entry) => entry.authorKey === author)
          .map((entry) => entry.seq)
      )
    promptCursors.set(
      key,
      Math.max(cursor, ...entries.map((entry) => entry.seq))
    )
    const messages = entries.filter(
      (entry) =>
        entry.seq > cursor &&
        entry.authorKey !== author &&
        isDoneMessage(entry)
    )
    const omitted = messages.slice(0, -wakeMessages)
    return {
      text: messages.slice(-wakeMessages).map(messageLine).join("\n"),
      note:
        omitted.length > 0
          ? `[Chat app] ${messages.length} messages came since your last turn. Here are the last ${wakeMessages}. Use read_messages for the older ones.`
          : null,
      ready: true,
      omittedThrough: omitted.at(-1)?.seq ?? null,
    }
  }

  function messageLine(entry: TimelineEntry): string {
    const text =
      entry.item.kind === "message"
        ? entry.item.text + sharedFileLines(entry.item.files)
        : ""
    return `[${authorName(entry.authorKey)}] ${text}`
  }

  async function summaryThrough(
    conversationId: string,
    throughSeq: number
  ): Promise<string | null> {
    for (;;) {
      const running = summaryRuns.get(conversationId)
      if (!running) break
      await running
    }
    const latest = store.latestSummary(conversationId)
    if (latest && latest.throughSeq >= throughSeq) return latest.text
    const run = runSummary(conversationId, latest, throughSeq)
    summaryRuns.set(conversationId, run)
    try {
      return await run
    } finally {
      summaryRuns.delete(conversationId)
    }
  }

  async function runSummary(
    conversationId: string,
    latest: { throughSeq: number; text: string } | undefined,
    throughSeq: number
  ): Promise<string | null> {
    if (!summarize) return null
    const lines = store
      .listTimeline(conversationId)
      .filter(
        (entry) =>
          entry.seq > (latest?.throughSeq ?? 0) &&
          entry.seq <= throughSeq &&
          isDoneMessage(entry)
      )
      .map(messageLine)
      .slice(-SUMMARY_MESSAGES)
    const summary = await summarize({
      earlier: latest?.text ?? null,
      lines,
    }).catch(() => null)
    if (!summary) return null
    store.saveSummary({
      conversationId,
      throughSeq,
      text: summary.text,
      costUsd: summary.costUsd,
    })
    return summary.text
  }

  function authorName(authorKey: string): string {
    if (!authorKey.startsWith("agent:")) return "User"
    return store.getAgent(authorKey.slice("agent:".length))?.name ?? "agent"
  }

  function prompt(agentId: string, conversationId: string, text: string) {
    const session = liveSessionFor(agentId, conversationId)
    if (!session) return
    const key = `${agentId} ${conversationId}`
    const removed = removedNotes.get(key) ?? []
    removedNotes.delete(key)
    const found = promptFor(agentId, conversationId, text)
    const queued: QueuedPrompt = {
      ...found,
      text:
        removed.map((path) => `[Removed file: ${path}]\n`).join("") +
        found.text,
      ready: found.omittedThrough === null || !summarize,
    }
    deliver(session, queued)
    if (queued.ready || queued.omittedThrough === null) return
    void summaryThrough(conversationId, queued.omittedThrough).then((text) => {
      if (text) {
        queued.note = [
          queued.note,
          "[Chat app] The summary of the conversation before these messages:",
          text,
        ].join("\n")
      }
      queued.ready = true
      deliverNext(session)
    })
  }

  function addressedAgents(
    conversationId: string,
    message: TimelineEntry
  ): string[] {
    const conversation = store.getConversation(conversationId)
    if (!conversation) return []
    if (conversation.kind === "dm" || conversation.replyMode === "every") {
      return agentIdsOf(conversationId)
    }
    const text = message.item.kind === "message" ? message.item.text : ""
    const mentioned = mentionedAgents(conversationId, text, null)
    return mentioned.length > 0
      ? mentioned
      : agentsWithQuestions(conversationId, message.seq)
  }

  function agentsWithQuestions(
    conversationId: string,
    beforeSeq: number
  ): string[] {
    const messages = store
      .listTimeline(conversationId)
      .filter((entry) => entry.seq < beforeSeq && entry.item.kind === "message")
    const lastUserSeq = Math.max(
      0,
      ...messages
        .filter((entry) => entry.authorKey === "user:me")
        .map((entry) => entry.seq)
    )
    const members = agentIdsOf(conversationId)
    const askers = messages.flatMap((entry) => {
      const agentId = entry.authorKey.slice("agent:".length)
      const asks =
        entry.seq > lastUserSeq &&
        members.includes(agentId) &&
        entry.item.kind === "message" &&
        entry.item.status === "done" &&
        QUESTION_MARK.test(entry.item.text) &&
        mentionedAgents(conversationId, entry.item.text, agentId).length === 0
      return asks ? [agentId] : []
    })
    return [...new Set(askers)]
  }

  function mentionedAgents(
    conversationId: string,
    text: string,
    authorAgentId: string | null
  ): string[] {
    if (store.getConversation(conversationId)?.kind === "dm") return []
    const members = agentIdsOf(conversationId).flatMap((agentId) => {
      const agent = store.getAgent(agentId)
      return agent && agent.id !== authorAgentId
        ? [{ key: agent.id, name: agent.name }]
        : []
    })
    return parseMentions(text, members)
  }

  function agentIdsOf(conversationId: string): string[] {
    const members = store.getConversation(conversationId)?.members ?? []
    return members
      .filter((member) => member.startsWith("agent:"))
      .map((member) => member.slice("agent:".length))
  }

  const http = createHttpServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) send(response, 500, { error: "server error" })
    })
  })

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", `http://${HOST}`)
    const parts = url.pathname.split("/").filter(Boolean)
    const route = (method: string, pattern: string) =>
      matchRoute(request.method, parts, method, pattern)
    let params: Record<string, string> | null

    if (url.pathname === "/mcp") return answerChat(request, response)

    if ((params = route("POST", "api/conversations/:id/read"))) {
      const conversationId = params.id
      if (!store.getConversation(conversationId)) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      if (!Number.isInteger(body.seq)) {
        return send(response, 400, {
          error: "Give the seq of the last item that the user saw.",
        })
      }
      store.markRead(conversationId, Number(body.seq))
      publishUnread(conversationId)
      response.writeHead(204).end()
      return
    }

    if ((params = route("PUT", "api/conversations/:id/uploads"))) {
      if (!store.getConversation(params.id)) {
        request.resume()
        return send(response, 404, { error: "no such conversation" })
      }
      const answer = await saveUpload(
        request,
        uploadsOf(uploadsFolder, params.id),
        url.searchParams.get("name") ?? "",
        uploadLimit
      )
      return send(response, answer.status, answer.body)
    }

    if ((params = route("POST", "api/conversations/:id/files/find"))) {
      if (!store.getConversation(params.id)) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      if (
        typeof body.name !== "string" ||
        typeof body.size !== "number" ||
        typeof body.sha256 !== "string"
      ) {
        return send(response, 400, { error: "Give the name, size and sha256." })
      }
      const path = await findFile(
        agentFoldersOf(params.id).map((folder) => folder.cwd),
        {
          name: body.name,
          size: body.size,
          sha256: body.sha256,
        }
      )
      return send(response, 200, { match: path ? { path } : null })
    }

    if ((params = route("GET", "api/conversations/:id/paths"))) {
      if (!store.getConversation(params.id)) {
        return send(response, 404, { error: "no such conversation" })
      }
      const folders = agentFoldersOf(params.id)
      return send(response, 200, {
        paths: await searchPaths(folders, url.searchParams.get("q") ?? ""),
      })
    }

    if ((params = route("GET", "api/conversations/:id/files"))) {
      if (!store.getConversation(params.id)) {
        return send(response, 404, { error: "no such conversation" })
      }
      return send(response, 200, { files: sharedFilesOf(params.id) })
    }

    if ((params = route("DELETE", "api/conversations/:id/files/:fileId"))) {
      const file = store.getSharedFile(params.fileId)
      if (!file || file.conversationId !== params.id) {
        return send(response, 404, { error: "no such shared file" })
      }
      const removed = store.removeSharedFile(file.id, "user:me")
      if (!file.removedAt) {
        if (file.kind === "copied") await rm(file.path, { force: true })
        for (const agentId of agentIdsOf(params.id)) {
          const key = `${agentId} ${params.id}`
          removedNotes.set(key, [...(removedNotes.get(key) ?? []), file.path])
        }
      }
      const files = sharedFilesOf(params.id)
      publish(params.id, { type: "files", files })
      return send(response, 200, {
        file: files.find((item) => item.id === removed?.id),
      })
    }

    if ((params = route("POST", "api/conversations/:id/messages"))) {
      const conversationId = params.id
      if (!store.getConversation(conversationId)) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      const text = typeof body.text === "string" ? body.text : ""
      const checked = await checkFiles(body.files, {
        agentFolders: agentFoldersOf(conversationId).map(
          (folder) => folder.cwd
        ),
        uploads: uploadsOf(uploadsFolder, conversationId),
      })
      if (!checked.ok) return send(response, 400, { error: checked.error })
      if (text.trim() === "" && checked.files.length === 0) {
        return send(response, 400, { error: "Write a message." })
      }
      const entry = store.addUserMessage(conversationId, text, checked.files)
      publish(conversationId, { type: "item", entry })
      if (checked.files.length > 0) {
        store.shareFiles(conversationId, entry.id, checked.files, "user:me")
        publish(conversationId, {
          type: "files",
          files: sharedFilesOf(conversationId),
        })
      }
      for (const agentId of addressedAgents(conversationId, entry)) {
        prompt(agentId, conversationId, text + sharedFileLines(checked.files))
      }
      return send(response, 202, { entry })
    }

    if ((params = route("GET", "api/conversations/:id/timeline"))) {
      return send(response, 200, {
        items: store.listTimeline(params.id),
        lastEventId: channelOf(params.id).nextId - 1,
      })
    }

    if (route("GET", "api/events")) {
      return openStream(appChannel, request, response, url)
    }

    if ((params = route("GET", "api/conversations/:id/events"))) {
      return openStream(channelOf(params.id), request, response, url)
    }

    if (
      (params = route("GET", "api/conversations/:id/agents/:agentId/session"))
    ) {
      const agent = store.getAgent(params.agentId)
      if (!agent) return send(response, 404, { error: "no such agent" })
      const conversation = store.getConversation(params.id)
      if (!conversation) {
        return send(response, 404, { error: "no such conversation" })
      }
      return send(response, 200, {
        session: sessionCard(agent, conversation),
      })
    }

    if (
      (params = route("POST", "api/conversations/:id/agents/:agentId/sessions"))
    ) {
      const agent = store.getAgent(params.agentId)
      const conversation = store.getConversation(params.id)
      const conversationId = params.id
      if (
        !agent ||
        !conversation ||
        !agentIdsOf(conversationId).includes(agent.id)
      ) {
        return send(response, 404, {
          error: "no such agent in this conversation",
        })
      }
      const running = findLive(agent.id, conversationId)
      if (running) {
        stopTurn(running)
        await running.handle?.stop()
      }
      const row = store.createSession({
        agentId: agent.id,
        conversationId,
        claudeSessionId: randomUUID(),
        claudeSessionNew: true,
        config: configOf(agent, folderFor(agent, conversation)),
      })
      const [entry] = store.saveItems(row.id, [
        {
          kind: "session_start",
          id: "start",
          status: "done",
          claudeSessionId: row.claudeSessionId ?? "",
        },
      ])
      if (entry) {
        publish(conversationId, { type: "item", entry })
        promptCursors.set(`${agent.id} ${conversationId}`, entry.seq)
      }
      start(row)
      return send(response, 201, {
        session: sessionCard(agent, conversation),
      })
    }

    if ((params = route("POST", "api/conversations/:id/members"))) {
      const conversation = store.getConversation(params.id)
      if (!conversation) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      const added = addMembers(conversation, texts(body.agentIds))
      if (!added.ok) return send(response, 400, { error: added.error })
      return send(response, 200, { conversation: added.conversation })
    }

    if ((params = route("DELETE", "api/conversations/:id/members/:agentId"))) {
      const conversation = store.getConversation(params.id)
      const memberKey = `agent:${params.agentId}`
      if (!conversation || !conversation.members.includes(memberKey)) {
        return send(response, 404, { error: "no such member" })
      }
      if (conversation.kind === "dm") {
        return send(response, 400, { error: "A DM has one agent." })
      }
      if (conversation.kind === "group" && agentIdsOf(params.id).length === 1) {
        return send(response, 400, {
          error: "A group chat needs one agent or more.",
        })
      }
      const running = findLive(params.agentId, params.id)
      if (running) {
        stopTurn(running)
        await running.handle?.stop()
      }
      store.removeMember(params.id, memberKey)
      promptCursors.delete(`${params.agentId} ${params.id}`)
      return send(response, 200, { conversation: membersChanged(params.id) })
    }

    if ((params = route("GET", "api/conversations/:id/agents/:agentId/log"))) {
      const before = Number(url.searchParams.get("before"))
      return send(response, 200, {
        lines: store.listAgentLines(params.agentId, params.id, {
          limit: LOG_PAGE,
          before: Number.isInteger(before) && before > 0 ? before : undefined,
        }),
      })
    }

    if ((params = route("POST", "api/conversations/:id/stop"))) {
      for (const session of live.values()) {
        if (session.conversationId === params.id) stopTurn(session)
      }
      return send(response, 202, {})
    }

    if (
      (params = route("POST", "api/conversations/:id/agents/:agentId/stop"))
    ) {
      const session = findLive(params.agentId, params.id)
      if (session) stopTurn(session)
      return send(response, 202, {})
    }

    if ((params = route("POST", "api/requests/:id"))) {
      const open = openRequests.get(params.id)
      if (!open) return send(response, 404, { error: "no open request" })
      const body = await readJson(request)
      open.session.handle?.answer(params.id, permissionAnswer(open.card, body))
      return send(response, 202, {})
    }

    if (route("GET", "api/agents")) {
      const agents = store
        .listAgents()
        .map((agent) => ({ ...agent, state: agentState(agent.id) }))
      return send(response, 200, { agents })
    }

    if (route("POST", "api/agents")) {
      const checked = checkBody(agentSchema, await readJson(request))
      if (!checked.ok) {
        return send(response, 400, {
          error: checked.error,
          fields: checked.fields,
        })
      }
      return send(response, 201, { agent: store.createAgent(checked.data) })
    }

    if ((params = route("GET", "api/agents/:id"))) {
      const agent = store.getAgent(params.id)
      if (!agent) return send(response, 404, { error: "no such agent" })
      return send(response, 200, { agent })
    }

    if (route("GET", "api/folders")) {
      const answer = await listFolders(url.searchParams.get("path"))
      return send(response, answer.status, answer.body)
    }

    if ((params = route("POST", "api/agents/:id/stop"))) {
      if (!store.getAgent(params.id)) {
        return send(response, 404, { error: "no such agent" })
      }
      await stopAgent(params.id)
      return send(response, 202, {})
    }

    if ((params = route("POST", "api/agents/:id/restart"))) {
      const agentId = params.id
      if (!store.getAgent(agentId)) {
        return send(response, 404, { error: "no such agent" })
      }
      const conversationIds = await stopAgent(agentId)
      for (const conversationId of conversationIds) {
        liveSessionFor(agentId, conversationId)
      }
      return send(response, 202, {})
    }

    if ((params = route("PATCH", "api/agents/:id"))) {
      const current = store.getAgent(params.id)
      if (!current) return send(response, 404, { error: "no such agent" })
      const checked = checkBody(agentSchema, {
        ...current,
        ...(await readJson(request)),
      })
      if (!checked.ok) {
        return send(response, 400, {
          error: checked.error,
          fields: checked.fields,
        })
      }
      return send(response, 200, {
        agent: store.updateAgent(params.id, checked.data),
      })
    }

    if ((params = route("PATCH", "api/conversations/:id"))) {
      const current = store.getConversation(params.id)
      if (!current) {
        return send(response, 404, { error: "no such conversation" })
      }
      if (current.kind !== "channel") {
        return send(response, 400, { error: "Only a channel has settings." })
      }
      const checked = checkBody(channelSettingsSchema, {
        ...current,
        ...(await readJson(request)),
      })
      if (!checked.ok) {
        return send(response, 400, {
          error: checked.error,
          fields: checked.fields,
        })
      }
      const { cwd } = checked.data
      const refused = cwd && cwd !== current.cwd ? await folderError(cwd) : null
      if (refused) {
        return send(response, 400, { error: refused, fields: { cwd: refused } })
      }
      const conversation = store.updateConversation(params.id, checked.data)
      if (conversation) announce(conversation)
      return send(response, 200, { conversation })
    }

    if ((params = route("GET", "api/conversations/:id"))) {
      const conversation = store.getConversation(params.id)
      if (!conversation) {
        return send(response, 404, { error: "no such conversation" })
      }
      const agents = agentIdsOf(conversation.id).flatMap((agentId) => {
        const agent = store.getAgent(agentId)
        if (!agent) return []
        return [
          {
            ...agent,
            state: liveState(agentId, conversation.id),
            sessionCwd: sessionCwd(agent, conversation),
          },
        ]
      })
      return send(response, 200, { conversation, agents })
    }

    if (route("GET", "api/conversations")) {
      return send(response, 200, {
        conversations: store.listConversations(),
        unread: store.unreadCounts(),
      })
    }

    if (route("POST", "api/conversations")) {
      const body = await readJson(request)
      if (body.kind === "group" || body.kind === "channel") {
        const cwd = body.kind === "channel" ? text(body.cwd).trim() : ""
        const refused = cwd ? await folderError(cwd) : null
        if (refused) {
          return send(response, 400, {
            error: refused,
            fields: { cwd: refused },
          })
        }
        const made = createGroupOrChannel(body)
        if (!made.ok) return send(response, made.status, made.body)
        return send(response, 201, { conversation: made.conversation })
      }
      const agent = store.getAgent(text(body.agentId))
      if (body.kind !== "dm" || !agent) {
        return send(response, 400, { error: "Give kind dm and an agentId." })
      }
      const existing = store.findDirectMessage(agent.id)
      if (existing) return send(response, 200, { conversation: existing })
      const conversation = store.createConversation({
        kind: "dm",
        name: agent.name,
        topic: null,
        private: true,
        replyMode: "every",
        members: ["user:me", `agent:${agent.id}`],
      })
      return created(response, conversation)
    }

    send(response, 404, { error: "not found" })
  }

  function createGroupOrChannel(
    body: Record<string, unknown>
  ):
    | { ok: true; conversation: Conversation }
    | { ok: false; status: number; body: Record<string, unknown> } {
    const agents = texts(body.agentIds).flatMap(
      (agentId) => store.getAgent(agentId) ?? []
    )
    const members = ["user:me", ...agents.map((agent) => `agent:${agent.id}`)]
    let conversation: Conversation
    if (body.kind === "group") {
      if (agents.length === 0) {
        return {
          ok: false,
          status: 400,
          body: { error: "Give one or more agentIds." },
        }
      }
      conversation = store.createConversation({
        kind: "group",
        name: agents.map((agent) => agent.name).join(", "),
        topic: null,
        private: true,
        replyMode: "mention",
        members,
      })
    } else {
      const checked = checkBody(channelSchema, body)
      if (!checked.ok) {
        return {
          ok: false,
          status: 400,
          body: { error: checked.error, fields: checked.fields },
        }
      }
      const { name, topic, replyMode, cwd } = checked.data
      const taken = store
        .listConversations()
        .some((item) => item.kind === "channel" && item.name === name)
      if (taken) {
        return {
          ok: false,
          status: 409,
          body: { error: `A channel with the name ${name} exists.` },
        }
      }
      conversation = store.createConversation({
        kind: "channel",
        name,
        topic,
        private: checked.data.private,
        replyMode,
        cwd,
        members,
      })
    }
    publishTo(appChannel, { type: "conversation", conversation })
    return { ok: true, conversation }
  }

  function addMembers(
    conversation: Conversation,
    agentIds: string[]
  ):
    | { ok: true; conversation: Conversation | undefined }
    | { ok: false; error: string } {
    if (conversation.kind === "dm") {
      return { ok: false, error: "A DM has one agent." }
    }
    for (const agentId of agentIds) {
      const memberKey = `agent:${agentId}`
      if (!store.getAgent(agentId)) continue
      if (conversation.members.includes(memberKey)) continue
      store.addMember(conversation.id, memberKey)
    }
    return { ok: true, conversation: membersChanged(conversation.id) }
  }

  function postMessage(conversationId: string, agentId: string, text: string) {
    const entry = store.addMessage(conversationId, `agent:${agentId}`, text)
    publish(conversationId, { type: "item", entry })
    publishUnread(conversationId)
    for (const mentioned of mentionedAgents(conversationId, text, agentId)) {
      prompt(mentioned, conversationId, text)
    }
    return entry
  }

  const chat: ChatServer = {
    store,
    liveState,
    agentState,
    authorName,
    postMessage,
    createGroupOrChannel,
    addMembers,
    sharedFiles: sharedFilesOf,
  }

  async function answerChat(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const session = tokens.get(
      (request.headers.authorization ?? "").replace(/^Bearer /, "")
    )
    if (!session) return send(response, 403, { error: "no such session" })
    if (request.method !== "POST") {
      response.writeHead(405, { allow: "POST" }).end()
      return
    }
    const answer = answerRpc(await readJson(request), chatTools(chat, session))
    if (answer === null) {
      response.writeHead(202).end()
      return
    }
    send(response, 200, answer)
  }

  return {
    autostart() {
      for (const agent of store.listAgents()) {
        if (!agent.autostart) continue
        const dm = store.findDirectMessage(agent.id)
        if (dm) liveSessionFor(agent.id, dm.id)
      }
    },
    listen(port: number): Promise<{ host: string; port: number }> {
      return new Promise((resolve) => {
        http.listen(port, HOST, () => {
          const address = http.address() as AddressInfo
          chatUrl = `http://${address.address}:${address.port}/mcp`
          resolve({ host: address.address, port: address.port })
        })
      })
    },
    async close(): Promise<void> {
      for (const session of live.values()) clearSleep(session)
      await Promise.all(
        [...live.values()].map((session) => session.handle?.stop())
      )
      for (const channel of [...channels.values(), appChannel]) {
        for (const client of channel.clients) client.end()
      }
      await new Promise<void>((resolve) => http.close(() => resolve()))
    },
  }
}

function isDoneMessage(entry: TimelineEntry): boolean {
  return entry.item.kind === "message" && entry.item.status === "done"
}

function gapNote(asleepForMs: number | null): string | undefined {
  const minutes = Math.floor((asleepForMs ?? 0) / 60_000)
  if (minutes < 60) return undefined
  return `[Chat app] You were asleep for ${Math.floor(minutes / 60)} h ${minutes % 60} min.`
}

function summaryPart(text: string): string {
  const start = text.indexOf(SUMMARY_HEADING)
  return start === -1 ? text : text.slice(start + SUMMARY_HEADING.length)
}

function configOf(agent: Agent, cwd: string): SessionConfig {
  return {
    model: agent.model,
    permissionMode: agent.permissionMode,
    cwd,
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    systemPrompt: agent.systemPrompt,
    maxTurns: agent.maxTurns,
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function matchRoute(
  method: string | undefined,
  parts: string[],
  wantedMethod: string,
  pattern: string
): Record<string, string> | null {
  if (method !== wantedMethod) return null
  const pieces = pattern.split("/")
  if (pieces.length !== parts.length) return null
  const params: Record<string, string> = {}
  for (const [index, piece] of pieces.entries()) {
    if (piece.startsWith(":")) {
      params[piece.slice(1)] = decodeURIComponent(parts[index])
    } else if (piece !== parts[index]) {
      return null
    }
  }
  return params
}

function permissionAnswer(
  card: PermissionItem | QuestionItem,
  body: Record<string, unknown>
): PermissionAnswer {
  if (card.kind === "question") {
    return {
      behavior: "allow",
      updatedInput: { questions: card.questions, answers: body.answers ?? {} },
    }
  }
  if (body.decision === "allow_once") {
    return { behavior: "allow", updatedInput: card.input }
  }
  if (body.decision === "always_allow") {
    return {
      behavior: "allow",
      updatedInput: card.input,
      updatedPermissions: card.suggestions,
    }
  }
  return { behavior: "deny", message: "The user denied this." }
}

function openStream(
  channel: Channel,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
) {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  })
  response.flushHeaders()
  const lastEventId = Number(
    request.headers["last-event-id"] ??
      url.searchParams.get("lastEventId") ??
      Number.NaN
  )
  if (Number.isInteger(lastEventId)) {
    const oldest = channel.log[0]?.id ?? channel.nextId
    if (lastEventId > channel.nextId - 1 || lastEventId < oldest - 1) {
      response.write(`data: ${JSON.stringify({ type: "reset" })}\n\n`)
    } else {
      for (const event of channel.log) {
        if (event.id > lastEventId) writeEvent(response, event)
      }
    }
  }
  channel.clients.add(response)
  request.on("close", () => channel.clients.delete(response))
}

function writeEvent(response: ServerResponse, event: StreamEvent) {
  response.write(`id: ${event.id}\ndata: ${event.data}\n\n`)
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

async function readJson(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error("body too large")
    chunks.push(chunk as Buffer)
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}
