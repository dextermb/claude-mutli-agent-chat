export type Json = Record<string, unknown>

export type InvalidLine = { kind: "invalid"; text: string }
export type UnknownLine = { kind: "unknown"; raw: Json }

export type InitLine = {
  kind: "init"
  sessionId: string
  model: string
  permissionMode: string
  cwd: string
  claudeCodeVersion: string
  tools: string[]
}

export type ToolUseBlock = {
  type: "tool_use"
  id: string
  name: string
  input: Json
}

export type TextBlock = { type: "text"; text: string }

export type AssistantBlock = TextBlock | ToolUseBlock

export type AssistantLine = {
  kind: "assistant"
  uuid: string
  parentToolUseId: string | null
  blocks: AssistantBlock[]
  model: string
  contextTokens: number
}

export type PermissionDecision = { decision: string; source: string }

export type ToolResult = {
  toolUseId: string
  isError: boolean
  content: string
  structured: unknown
  decision: PermissionDecision | null
}

export type ToolResultsLine = {
  kind: "tool_results"
  uuid: string
  parentToolUseId: string | null
  results: ToolResult[]
}

export type PromptEchoLine = { kind: "prompt_echo"; uuid: string; text: string }

export type TextDeltaLine = {
  kind: "text_delta"
  index: number
  text: string
  parentToolUseId: string | null
}

export type PermissionRequestLine = {
  kind: "permission_request"
  requestId: string
  toolName: string
  toolUseId: string
  description: string
  input: Json
  suggestions: Json[]
}

export type PermissionAnswerLine = {
  kind: "permission_answer"
  requestId: string
  behavior: "allow" | "deny"
  updatedInput: Json
  updatedPermissions: Json[]
}

export type ResultLine = {
  kind: "result"
  subtype: string
  isError: boolean
  terminalReason: string
  durationMs: number
  numTurns: number
  totalCostUsd: number
  contextWindows: Record<string, number>
  sessionId: string
  permissionDenials: { toolName: string; toolUseId: string }[]
}

export type TaskLine = {
  kind: "task"
  event: "started" | "updated" | "notification"
  taskId: string
  toolUseId: string
  taskType: string
  description: string
  status: string | null
}

export type RateLimitLine = {
  kind: "rate_limit"
  status: string
  rateLimitType: string
  resetsAt: number
}

export type DecodedLine =
  | InvalidLine
  | RateLimitLine
  | TaskLine
  | ResultLine
  | PermissionRequestLine
  | PermissionAnswerLine
  | TextDeltaLine
  | PromptEchoLine
  | UnknownLine
  | InitLine
  | AssistantLine
  | ToolResultsLine

export function decodeLine(text: string): DecodedLine {
  const raw = parseObject(text)
  if (!raw) return { kind: "invalid", text }
  if (raw.type === "system" && raw.subtype === "init") return decodeInit(raw)
  if (raw.type === "system") return decodeTask(raw)
  if (raw.type === "assistant") return decodeAssistant(raw)
  if (raw.type === "user") return decodeUser(raw)
  if (raw.type === "stream_event") return decodeStreamEvent(raw)
  if (raw.type === "control_request") return decodeControlRequest(raw)
  if (raw.type === "control_response") return decodeControlResponse(raw)
  if (raw.type === "result") return decodeResult(raw)
  if (raw.type === "rate_limit_event") return decodeRateLimit(raw)
  return { kind: "unknown", raw }
}

function decodeInit(raw: Json): InitLine {
  return {
    kind: "init",
    sessionId: string(raw.session_id),
    model: string(raw.model),
    permissionMode: string(raw.permissionMode),
    cwd: string(raw.cwd),
    claudeCodeVersion: string(raw.claude_code_version),
    tools: array(raw.tools).map(string),
  }
}

function decodeAssistant(raw: Json): AssistantLine {
  return {
    kind: "assistant",
    uuid: string(raw.uuid),
    parentToolUseId: nullableString(raw.parent_tool_use_id),
    blocks: contentBlocks(raw.message).flatMap(decodeAssistantBlock),
    model: string(object(raw.message).model),
    contextTokens: contextTokens(object(object(raw.message).usage)),
  }
}

function contextTokens(usage: Json): number {
  return (
    number(usage.input_tokens) +
    number(usage.cache_creation_input_tokens) +
    number(usage.cache_read_input_tokens)
  )
}

function decodeAssistantBlock(block: Json): AssistantBlock[] {
  if (block.type === "text") return [{ type: "text", text: string(block.text) }]
  if (block.type === "tool_use") {
    return [
      {
        type: "tool_use",
        id: string(block.id),
        name: string(block.name),
        input: object(block.input),
      },
    ]
  }
  return []
}

const TASK_EVENTS: Record<string, TaskLine["event"]> = {
  task_started: "started",
  task_updated: "updated",
  task_notification: "notification",
}

function decodeTask(raw: Json): DecodedLine {
  const event = TASK_EVENTS[string(raw.subtype)]
  if (!event) return { kind: "unknown", raw }
  return {
    kind: "task",
    event,
    taskId: string(raw.task_id),
    toolUseId: string(raw.tool_use_id),
    taskType: string(raw.task_type),
    description: string(raw.description),
    status: nullableString(raw.status ?? object(raw.patch).status),
  }
}

function decodeRateLimit(raw: Json): RateLimitLine {
  const info = object(raw.rate_limit_info)
  return {
    kind: "rate_limit",
    status: string(info.status),
    rateLimitType: string(info.rateLimitType),
    resetsAt: number(info.resetsAt),
  }
}

function decodeResult(raw: Json): ResultLine {
  return {
    kind: "result",
    subtype: string(raw.subtype),
    isError: raw.is_error === true,
    terminalReason: string(raw.terminal_reason),
    durationMs: number(raw.duration_ms),
    numTurns: number(raw.num_turns),
    totalCostUsd: number(raw.total_cost_usd),
    contextWindows: Object.fromEntries(
      Object.entries(object(raw.modelUsage)).map(([model, usage]) => [
        model,
        number(object(usage as Json).contextWindow),
      ])
    ),
    sessionId: string(raw.session_id),
    permissionDenials: array(raw.permission_denials)
      .filter(isObject)
      .map((denial) => ({
        toolName: string(denial.tool_name),
        toolUseId: string(denial.tool_use_id),
      })),
  }
}

function decodeControlResponse(raw: Json): DecodedLine {
  const response = object(raw.response)
  const answer = object(response.response)
  if (answer.behavior !== "allow" && answer.behavior !== "deny") {
    return { kind: "unknown", raw }
  }
  return {
    kind: "permission_answer",
    requestId: string(response.request_id),
    behavior: answer.behavior,
    updatedInput: object(answer.updatedInput),
    updatedPermissions: array(answer.updatedPermissions).filter(isObject),
  }
}

function decodeControlRequest(raw: Json): DecodedLine {
  const request = object(raw.request)
  if (request.subtype !== "can_use_tool") return { kind: "unknown", raw }
  return {
    kind: "permission_request",
    requestId: string(raw.request_id),
    toolName: string(request.tool_name),
    toolUseId: string(request.tool_use_id),
    description: string(request.description),
    input: object(request.input),
    suggestions: array(request.permission_suggestions).filter(isObject),
  }
}

function decodeStreamEvent(raw: Json): DecodedLine {
  const event = object(raw.event)
  const delta = object(event.delta)
  if (event.type !== "content_block_delta" || delta.type !== "text_delta") {
    return { kind: "unknown", raw }
  }
  return {
    kind: "text_delta",
    index: typeof event.index === "number" ? event.index : 0,
    text: string(delta.text),
    parentToolUseId: nullableString(raw.parent_tool_use_id),
  }
}

function decodeUser(raw: Json): DecodedLine {
  if (raw.isReplay === true) {
    return {
      kind: "prompt_echo",
      uuid: string(raw.uuid),
      text: resultText(object(raw.message).content),
    }
  }
  const blocks = contentBlocks(raw.message).filter(
    (block) => block.type === "tool_result"
  )
  if (blocks.length === 0) return { kind: "unknown", raw }
  const decisions = array(raw.tool_result_meta).filter(isObject)
  return {
    kind: "tool_results",
    uuid: string(raw.uuid),
    parentToolUseId: nullableString(raw.parent_tool_use_id),
    results: blocks.map((block) => {
      const toolUseId = string(block.tool_use_id)
      return {
        toolUseId,
        isError: block.is_error === true,
        content: resultText(block.content),
        structured: blocks.length === 1 ? (raw.tool_use_result ?? null) : null,
        decision: permissionDecision(decisions, toolUseId),
      }
    }),
  }
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content
  return array(content)
    .filter(isObject)
    .filter((block) => block.type === "text")
    .map((block) => string(block.text))
    .join("\n")
}

function permissionDecision(
  meta: Json[],
  toolUseId: string
): PermissionDecision | null {
  const entry = meta.find((candidate) => candidate.id === toolUseId)
  const decision = object(entry?.permission_decision)
  if (typeof decision.decision !== "string") return null
  return { decision: decision.decision, source: string(decision.source) }
}

function contentBlocks(message: unknown): Json[] {
  const content = object(message).content
  if (typeof content === "string") return [{ type: "text", text: content }]
  return array(content).filter(isObject)
}

function parseObject(text: string): Json | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return isObject(value) ? value : undefined
  } catch {
    return undefined
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function string(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function number(value: unknown): number {
  return typeof value === "number" ? value : 0
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function object(value: unknown): Json {
  return isObject(value) ? value : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
