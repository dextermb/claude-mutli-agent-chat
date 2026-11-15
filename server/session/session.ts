import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"
import { decodeLine, type DecodedLine } from "../protocol/decode.ts"
import {
  encodeInitialize,
  encodeInterrupt,
  encodePermissionAnswer,
  encodePrompt,
  type PermissionAnswer,
} from "../protocol/encode.ts"
import {
  emptyTimeline,
  reduceTimeline,
  type TimelineItem,
  type TimelineState,
} from "../timeline/reduce.ts"
import type { SessionState } from "../api-types.ts"
import { childEnvironment } from "./environment.ts"

export type { SessionState } from "../api-types.ts"

export type SessionEvent =
  | { type: "state"; state: SessionState }
  | { type: "claude_session"; claudeSessionId: string }
  | { type: "changes"; items: TimelineItem[] }
  | { type: "line"; direction: "in" | "out"; text: string }

export type SessionOptions = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  onEvent: (event: SessionEvent) => void
}

const INITIALIZE_REQUEST = "initialize-1"

export class AgentSession {
  private readonly options: SessionOptions
  private child: ChildProcessWithoutNullStreams | null = null
  private exited: Promise<void> = Promise.resolve()
  private state: SessionState | null = null
  private timeline: TimelineState = emptyTimeline()
  private interrupts = 0

  constructor(options: SessionOptions) {
    this.options = options
  }

  start() {
    const child = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: childEnvironment(this.options.env),
    })
    this.child = child
    this.exited = new Promise((resolve) =>
      child.on("exit", (code) => {
        this.setState(code === 0 ? "exited" : "failed")
        resolve()
      })
    )
    createInterface({ input: child.stdout }).on("line", (text) => {
      this.options.onEvent({ type: "line", direction: "out", text })
      this.read(decodeLine(text))
    })
    this.setState("starting")
    this.write(encodeInitialize(INITIALIZE_REQUEST))
  }

  prompt(text: string) {
    if (this.write(encodePrompt(text))) this.setState("busy")
  }

  answer(requestId: string, answer: PermissionAnswer) {
    this.write(encodePermissionAnswer(requestId, answer))
  }

  interrupt() {
    this.interrupts += 1
    this.write(encodeInterrupt(`interrupt-${this.interrupts}`))
  }

  async stop() {
    this.child?.stdin.end()
    await this.exited
  }

  private read(line: DecodedLine) {
    const step = reduceTimeline(this.timeline, line)
    this.timeline = step.state
    if (step.changes.length > 0) {
      this.options.onEvent({ type: "changes", items: step.changes })
    }
    if (line.kind === "unknown" && isInitializeAnswer(line.raw)) {
      this.setState("idle")
    }
    if (line.kind === "init") {
      this.options.onEvent({
        type: "claude_session",
        claudeSessionId: line.sessionId,
      })
    }
    if (line.kind === "permission_request") this.setState("waiting")
    if (line.kind === "permission_answer") this.setState("busy")
    if (line.kind === "result") this.setState("idle")
  }

  private write(text: string): boolean {
    if (!this.child || this.ended()) return false
    this.options.onEvent({ type: "line", direction: "in", text })
    this.child.stdin.write(text + "\n")
    return true
  }

  private ended(): boolean {
    return this.state === "exited" || this.state === "failed"
  }

  private setState(state: SessionState) {
    if (state === this.state) return
    this.state = state
    this.options.onEvent({ type: "state", state })
  }
}

function isInitializeAnswer(raw: Record<string, unknown>): boolean {
  const response = raw.response
  return (
    raw.type === "control_response" &&
    typeof response === "object" &&
    response !== null &&
    (response as Record<string, unknown>).request_id === INITIALIZE_REQUEST
  )
}
