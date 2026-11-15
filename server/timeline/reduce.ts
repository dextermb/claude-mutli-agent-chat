import type {
  AssistantLine,
  DecodedLine,
  Json,
  PermissionAnswerLine,
  PermissionDecision,
  PermissionRequestLine,
  ResultLine,
  RateLimitLine,
  TaskLine,
  ToolResult,
  TextDeltaLine,
  ToolResultsLine,
} from "../protocol/decode.ts"

export type ToolCallResult =
  | { kind: "lines"; count: number }
  | { kind: "diff"; added: number; removed: number }
  | { kind: "output"; stdout: string; stderr: string }
  | { kind: "error"; message: string }

export type ToolCallItem = {
  kind: "tool_call"
  id: string
  toolUseId: string
  name: string
  input: Json
  status: "running" | "done" | "error" | "stopped"
  result: ToolCallResult | null
  decision: PermissionDecision | null
  job: { taskId: string; status: string } | null
  parentToolUseId: string | null
}

export type MessageItem = {
  kind: "message"
  id: string
  text: string
  status: "streaming" | "done"
}

export type PermissionItem = {
  kind: "permission"
  id: string
  requestId: string
  toolUseId: string
  toolName: string
  description: string
  input: Json
  suggestions: Json[]
  status: "pending" | "allowed" | "denied" | "expired"
}

export type QuestionItem = {
  kind: "question"
  id: string
  requestId: string
  toolUseId: string
  questions: Json[]
  status: "pending" | "answered" | "expired"
  answers: Record<string, string> | null
}

export type TurnItem = {
  kind: "turn"
  id: string
  status: "done" | "stopped" | "limit"
  durationMs: number
  costUsd: number
  numTurns: number
}

export type NoticeItem =
  | {
      kind: "notice"
      id: string
      reason: "rate_limit"
      status: string
      rateLimitType: string
      resetsAt: number
    }
  | {
      kind: "notice"
      id: string
      reason: "failed"
      status: "failed"
      exitCode: number | null
      stderr: string
    }

export type SessionStartItem = {
  kind: "session_start"
  id: string
  status: "done"
  claudeSessionId: string
}

export type TimelineItem =
  | ToolCallItem
  | MessageItem
  | PermissionItem
  | QuestionItem
  | TurnItem
  | NoticeItem
  | SessionStartItem

const QUESTION_TOOL = "AskUserQuestion"
const INTERRUPTED = ["aborted_streaming", "aborted_tools"]

export type TimelineState = {
  items: TimelineItem[]
  nextId: number
  draftId: string | null
  costSoFar: number
  rateLimitStatus: string
}

export type TimelineStep = {
  state: TimelineState
  changes: TimelineItem[]
}

export function emptyTimeline(): TimelineState {
  return {
    items: [],
    nextId: 1,
    draftId: null,
    costSoFar: 0,
    rateLimitStatus: "allowed",
  }
}

export function reduceTimeline(
  state: TimelineState,
  line: DecodedLine
): TimelineStep {
  if (line.kind === "text_delta") return reduceTextDelta(state, line)
  if (line.kind === "assistant") return reduceAssistant(state, line)
  if (line.kind === "tool_results") return reduceToolResults(state, line)
  if (line.kind === "permission_request") {
    return reducePermissionRequest(state, line)
  }
  if (line.kind === "permission_answer") {
    return reducePermissionAnswer(state, line)
  }
  if (line.kind === "result") return reduceResult(state, line)
  if (line.kind === "task") return reduceTask(state, line)
  if (line.kind === "rate_limit") return reduceRateLimit(state, line)
  return { state, changes: [] }
}

function reduceTextDelta(
  state: TimelineState,
  line: TextDeltaLine
): TimelineStep {
  const step: TimelineStep = { state, changes: [] }
  const draft = findDraft(state)
  if (draft) return replace(step, { ...draft, text: draft.text + line.text })
  const added = add(step, (id) => ({
    kind: "message",
    id,
    text: line.text,
    status: "streaming",
  }))
  return withDraft(added, added.changes[0].id)
}

function reduceAssistant(
  state: TimelineState,
  line: AssistantLine
): TimelineStep {
  let step: TimelineStep = { state, changes: [] }
  for (const block of line.blocks) {
    if (block.type === "text") {
      step = completeMessage(step, block.text)
      continue
    }
    if (block.name === QUESTION_TOOL) continue
    step = add(step, (id) => ({
      kind: "tool_call",
      id,
      toolUseId: block.id,
      name: block.name,
      input: block.input,
      status: "running",
      result: null,
      decision: null,
      job: null,
      parentToolUseId: line.parentToolUseId,
    }))
  }
  return step
}

function completeMessage(step: TimelineStep, text: string): TimelineStep {
  const draft = findDraft(step.state)
  if (draft) {
    return withDraft(replace(step, { ...draft, text, status: "done" }), null)
  }
  return add(step, (id) => ({ kind: "message", id, text, status: "done" }))
}

function findDraft(state: TimelineState): MessageItem | undefined {
  const draft = state.items.find((item) => item.id === state.draftId)
  return draft?.kind === "message" ? draft : undefined
}

function withDraft(step: TimelineStep, draftId: string | null): TimelineStep {
  return { ...step, state: { ...step.state, draftId } }
}

function reduceToolResults(
  state: TimelineState,
  line: ToolResultsLine
): TimelineStep {
  let step: TimelineStep = { state, changes: [] }
  for (const result of line.results) {
    const call = findToolCall(step.state, result.toolUseId)
    if (!call) continue
    step = replace(step, {
      ...call,
      status: result.isError ? "error" : "done",
      result: toolCallResult(result),
      decision: result.decision,
    })
  }
  return step
}

function reducePermissionRequest(
  state: TimelineState,
  line: PermissionRequestLine
): TimelineStep {
  if (line.toolName === QUESTION_TOOL) {
    return add({ state, changes: [] }, (id) => ({
      kind: "question",
      id,
      requestId: line.requestId,
      toolUseId: line.toolUseId,
      questions: asArray(line.input.questions).filter(isObject),
      status: "pending",
      answers: null,
    }))
  }
  return add({ state, changes: [] }, (id) => ({
    kind: "permission",
    id,
    requestId: line.requestId,
    toolUseId: line.toolUseId,
    toolName: line.toolName,
    description: line.description,
    input: line.input,
    suggestions: line.suggestions,
    status: "pending",
  }))
}

function reducePermissionAnswer(
  state: TimelineState,
  line: PermissionAnswerLine
): TimelineStep {
  const step: TimelineStep = { state, changes: [] }
  const card = state.items.find(
    (item) =>
      (item.kind === "permission" || item.kind === "question") &&
      item.requestId === line.requestId
  )
  if (card?.kind === "question") {
    return replace(step, {
      ...card,
      status: "answered",
      answers: stringRecord(line.updatedInput.answers),
    })
  }
  if (card?.kind !== "permission") return step
  return replace(step, {
    ...card,
    status: line.behavior === "allow" ? "allowed" : "denied",
  })
}

function reduceResult(state: TimelineState, line: ResultLine): TimelineStep {
  const start =
    line.terminalReason === "aborted_tools"
      ? stopLastToolCall({ state, changes: [] })
      : { state, changes: [] }
  const step = add(start, (id) => ({
    kind: "turn",
    id,
    status: turnStatus(line.terminalReason),
    durationMs: line.durationMs,
    costUsd: line.totalCostUsd - state.costSoFar,
    numTurns: line.numTurns,
  }))
  return { ...step, state: { ...step.state, costSoFar: line.totalCostUsd } }
}

function turnStatus(terminalReason: string): TurnItem["status"] {
  if (INTERRUPTED.includes(terminalReason)) return "stopped"
  return terminalReason === "max_turns" ? "limit" : "done"
}

function stopLastToolCall(step: TimelineStep): TimelineStep {
  const items = step.state.items
  const turnStart = items.findLastIndex((item) => item.kind === "turn") + 1
  const call = items
    .slice(turnStart)
    .findLast((item) => item.kind === "tool_call")
  if (call?.kind !== "tool_call" || call.status !== "error") return step
  return replace(step, { ...call, status: "stopped", result: null })
}

function reduceRateLimit(
  state: TimelineState,
  line: RateLimitLine
): TimelineStep {
  const step: TimelineStep = {
    state: { ...state, rateLimitStatus: line.status },
    changes: [],
  }
  if (line.status === "allowed" || line.status === state.rateLimitStatus) {
    return step
  }
  return add(step, (id) => ({
    kind: "notice",
    id,
    reason: "rate_limit",
    status: line.status,
    rateLimitType: line.rateLimitType,
    resetsAt: line.resetsAt,
  }))
}

function reduceTask(state: TimelineState, line: TaskLine): TimelineStep {
  const step: TimelineStep = { state, changes: [] }
  if (line.event === "started") {
    const call = findToolCall(state, line.toolUseId)
    if (!call) return step
    return replace(step, {
      ...call,
      job: { taskId: line.taskId, status: "running" },
    })
  }
  const call = state.items.find(
    (item) => item.kind === "tool_call" && item.job?.taskId === line.taskId
  )
  if (call?.kind !== "tool_call" || !call.job || !line.status) return step
  return replace(step, { ...call, job: { ...call.job, status: line.status } })
}

function findToolCall(
  state: TimelineState,
  toolUseId: string
): ToolCallItem | undefined {
  const call = state.items.find(
    (item) => item.kind === "tool_call" && item.toolUseId === toolUseId
  )
  return call?.kind === "tool_call" ? call : undefined
}

function toolCallResult(result: ToolResult): ToolCallResult | null {
  if (result.isError) return { kind: "error", message: result.content }
  const structured = asObject(result.structured)
  const file = asObject(structured.file)
  if (typeof file.numLines === "number") {
    return { kind: "lines", count: file.numLines }
  }
  if (structured.type === "create" && typeof structured.content === "string") {
    return { kind: "diff", added: lineCount(structured.content), removed: 0 }
  }
  if (Array.isArray(structured.structuredPatch)) {
    return diff(structured.structuredPatch)
  }
  if (typeof structured.stdout === "string") {
    return {
      kind: "output",
      stdout: structured.stdout,
      stderr: typeof structured.stderr === "string" ? structured.stderr : "",
    }
  }
  return null
}

function diff(hunks: unknown[]): ToolCallResult {
  const lines = hunks.flatMap((hunk) => {
    const hunkLines = asObject(hunk).lines
    return Array.isArray(hunkLines) ? hunkLines : []
  })
  return {
    kind: "diff",
    added: lines.filter((line) => String(line).startsWith("+")).length,
    removed: lines.filter((line) => String(line).startsWith("-")).length,
  }
}

function add(
  step: TimelineStep,
  build: (id: string) => TimelineItem
): TimelineStep {
  const item = build(`item-${step.state.nextId}`)
  return {
    state: {
      ...step.state,
      items: [...step.state.items, item],
      nextId: step.state.nextId + 1,
    },
    changes: [...step.changes, item],
  }
}

function replace(step: TimelineStep, item: TimelineItem): TimelineStep {
  return {
    state: {
      ...step.state,
      items: step.state.items.map((existing) =>
        existing.id === item.id ? item : existing
      ),
    },
    changes: [...step.changes, item],
  }
}

function lineCount(text: string): number {
  if (text === "") return 0
  return text.replace(/\n$/, "").split("\n").length
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asObject(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  )
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asObject(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {}
}
