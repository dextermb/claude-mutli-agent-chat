import { createInterface } from "node:readline"
import { readFixture } from "./fixtures.ts"

type Json = Record<string, unknown>

const fixture = readFixture(process.env.FAKE_CLAUDE_FIXTURE ?? "")
const mode = process.env.FAKE_CLAUDE_MODE ?? "play"
const reply = process.env.FAKE_CLAUDE_REPLY
const input = createInterface({ input: process.stdin })[Symbol.asyncIterator]()
const requestIds = new Map<string, string>()

if (mode === "hang") {
  process.on("SIGTERM", () => undefined)
}

const recordedInitialize = fixture.find(
  ({ dir, line }) => dir === "in" && subtype(line) === "initialize"
)
const initializeAnswer = fixture.find(
  ({ dir, line }) =>
    dir === "out" &&
    line.type === "control_response" &&
    object(line.response).request_id === recordedInitialize?.line.request_id
)

for (const { dir, line } of fixture) {
  if (dir === "out") {
    if (line !== initializeAnswer?.line) write(line)
    continue
  }
  const received = await nextInput()
  if (!received) break
  if (received.type !== line.type || subtype(received) !== subtype(line)) {
    fail(`expected ${String(line.type)}, got ${String(received.type)}`)
  }
  if (mode === "crash" && line.type === "user") {
    fail("crash on the first prompt")
  }
  if (mode === "not-json" && line.type === "user") {
    process.stdout.write("Warning: this line is not JSON\n")
  }
  if (mode === "env" && line.type === "user") {
    const names = Object.keys(process.env).filter((name) =>
      name.startsWith("CLAUDE")
    )
    process.stdout.write(`env: ${names.sort().join(" ")}\n`)
    process.stdout.write(`AGENT_CHAT: ${process.env.AGENT_CHAT ?? "unset"}\n`)
  }
  if (line.type === "control_request") {
    requestIds.set(String(line.request_id), String(received.request_id))
  }
  if (subtype(line) === "initialize" && initializeAnswer) {
    write(initializeAnswer.line)
  }
}

while (await nextInput()) {
  continue
}
await end()

async function end(): Promise<never> {
  if (mode === "hang") setInterval(() => undefined, 1000)
  else process.exit(0)
  return new Promise<never>(() => undefined)
}

async function nextInput(): Promise<Json | null> {
  const next = await input.next()
  if (next.done) return null
  return JSON.parse(next.value) as Json
}

function write(line: Json) {
  const replied = withReply(line)
  if (!replied) return
  process.stdout.write(JSON.stringify(withRequestId(replied)) + "\n")
}

function withReply(line: Json): Json | null {
  if (reply === undefined) return line
  if (line.type === "stream_event") return null
  if (line.type !== "assistant") return line
  const message = object(line.message)
  const content = Array.isArray(message.content) ? message.content : []
  return {
    ...line,
    message: {
      ...message,
      content: content.map((block: Json) =>
        block.type === "text" ? { ...block, text: reply } : block
      ),
    },
  }
}

function withRequestId(line: Json): Json {
  if (line.type !== "control_response") return line
  const response = object(line.response)
  const requestId = requestIds.get(String(response.request_id))
  if (!requestId) return line
  return { ...line, response: { ...response, request_id: requestId } }
}

function subtype(line: Json): unknown {
  return object(line.request).subtype
}

function object(value: unknown): Json {
  return typeof value === "object" && value !== null ? (value as Json) : {}
}

function fail(message: string): never {
  process.stderr.write(`fake claude (${mode}): ${message}\n`)
  process.exit(1)
}
