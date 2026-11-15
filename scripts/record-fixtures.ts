import { spawn } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { childEnvironment } from "../server/session/environment.ts"

type Json = Record<string, unknown>
type Envelope = { dir: "in" | "out"; line: Json }

type Run = {
  prompts: string[]
  resumeFrom?: string
  interruptAfterText?: boolean
  interruptAfterToolUseMs?: number
  answerTogetherInReverse?: boolean
  settleMs?: number
}

type Scenario = {
  name: string
  permissionMode: string
  runs: Run[]
}

const FIXTURE_ROOT = "/tmp/claude-fixture"

const PERSONAL_INIT_LISTS = [
  "skills",
  "slash_commands",
  "terminal_slash_commands",
  "plugins",
  "agents",
]

const scenarios: Scenario[] = [
  {
    name: "tools",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Do these steps in order, with one tool call for each step. " +
            "1) Read notes.txt. 2) Read missing.txt. 3) Run the bash command: echo hello. " +
            "4) Use the Edit tool to change the line beta in notes.txt to BETA. " +
            "5) Run the bash command: rm notes.txt. 6) Write a new file out.txt that holds the word done. " +
            "Then reply in one short sentence.",
        ],
      },
    ],
  },
  {
    name: "question",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Use the AskUserQuestion tool to ask me one question: which colour I prefer, " +
            "with the options Red and Blue. Then reply in one sentence that names my answer.",
        ],
      },
    ],
  },
  {
    name: "interrupt",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Write an 800-word story about a lighthouse. Do not use any tools.",
        ],
        interruptAfterText: true,
      },
    ],
  },
  {
    name: "resume",
    permissionMode: "default",
    runs: [
      { prompts: ["Remember the word kiwi. Reply with the single word ok."] },
      {
        prompts: [
          "Which word did I ask you to remember? Reply with that word only.",
        ],
        resumeFrom: "previous",
      },
    ],
  },
  {
    name: "background",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Run the bash command `sleep 3 && echo finished` with run_in_background set to true. " +
            "Do not wait for it. Reply in one short sentence.",
        ],
        settleMs: 20000,
      },
    ],
  },
  {
    name: "interrupt-tool",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Run the bash command `ping -c 30 127.0.0.1` in the foreground, not in the background. " +
            "Then reply in one short sentence.",
        ],
        interruptAfterToolUseMs: 3000,
      },
    ],
  },
  {
    name: "two-requests",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "In one message, make two Write tool calls in parallel: write a.txt that holds the word one, " +
            "and write b.txt that holds the word two. Then reply in one short sentence.",
        ],
        answerTogetherInReverse: true,
      },
    ],
  },
  {
    name: "subagent",
    permissionMode: "default",
    runs: [
      {
        prompts: [
          "Use the Agent tool with the general-purpose subagent to read notes.txt and report its first line. " +
            "Then reply with that line only.",
        ],
      },
    ],
  },
]

function answerFor(request: Json, allowOnce = false): Json {
  const toolName = String(request.tool_name)
  const input = (request.input ?? {}) as Json
  if (toolName === "AskUserQuestion") {
    const questions = (input.questions ?? []) as {
      question: string
      options?: { label: string }[]
    }[]
    const answers = Object.fromEntries(
      questions.map((q) => [q.question, q.options?.[0]?.label ?? "Yes"])
    )
    return { behavior: "allow", updatedInput: { ...input, answers } }
  }
  if (toolName === "Bash" && /\brm\b/.test(String(input.command))) {
    return { behavior: "deny", message: "The user denied this command." }
  }
  if (toolName === "Write" && !allowOnce) {
    return {
      behavior: "allow",
      updatedInput: input,
      updatedPermissions: request.permission_suggestions ?? [],
    }
  }
  return { behavior: "allow", updatedInput: input }
}

function record(
  scenario: Scenario,
  run: Run,
  workDir: string,
  sessionId: string | undefined
): Promise<Envelope[]> {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--replay-user-messages",
    "--permission-prompt-tool",
    "stdio",
    "--setting-sources",
    "user,project",
    "--model",
    "haiku",
    "--permission-mode",
    scenario.permissionMode,
    ...(sessionId ? ["--resume", sessionId] : []),
  ]
  const child = spawn("claude", args, {
    cwd: workDir,
    env: childEnvironment(process.env),
    stdio: ["pipe", "pipe", "pipe"],
  })
  const envelopes: Envelope[] = []
  const prompts = [...run.prompts]
  let settleTimer: NodeJS.Timeout | undefined

  const send = (line: Json) => {
    envelopes.push({ dir: "in", line })
    child.stdin.write(JSON.stringify(line) + "\n")
  }

  const sendNextPrompt = () => {
    clearTimeout(settleTimer)
    const text = prompts.shift()
    if (text === undefined) {
      settleTimer = setTimeout(() => child.stdin.end(), run.settleMs ?? 1500)
      return
    }
    send({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
      parent_tool_use_id: null,
    })
  }

  let interruptSent = false
  const interruptOnText = (line: Json) => {
    const delta = ((line.event as Json | undefined)?.delta ?? {}) as Json
    if (!run.interruptAfterText || interruptSent || delta.type !== "text_delta")
      return
    interruptSent = true
    setTimeout(
      () =>
        send({
          type: "control_request",
          request_id: "interrupt-1",
          request: { subtype: "interrupt" },
        }),
      500
    )
  }

  const interruptOnToolUse = (line: Json) => {
    if (run.interruptAfterToolUseMs === undefined || interruptSent) return
    const content = ((line.message as Json | undefined)?.content ??
      []) as Json[]
    if (
      line.type !== "assistant" ||
      !content.some((b) => b.type === "tool_use")
    )
      return
    interruptSent = true
    setTimeout(
      () =>
        send({
          type: "control_request",
          request_id: "interrupt-1",
          request: { subtype: "interrupt" },
        }),
      run.interruptAfterToolUseMs
    )
  }

  const answer = (line: Json) =>
    send({
      type: "control_response",
      response: {
        subtype: "success",
        request_id: line.request_id,
        response: answerFor(
          line.request as Json,
          run.answerTogetherInReverse === true
        ),
      },
    })

  let waiting: Json[] = []
  let waitTimer: NodeJS.Timeout | undefined
  const answerWaiting = () => {
    clearTimeout(waitTimer)
    const lines = waiting.reverse()
    waiting = []
    for (const line of lines) answer(line)
  }

  createInterface({ input: child.stderr }).on("line", (text) =>
    process.stderr.write(`[${scenario.name}] ${text}\n`)
  )
  createInterface({ input: child.stdout }).on("line", (text) => {
    const line = JSON.parse(text) as Json
    envelopes.push({ dir: "out", line })
    interruptOnText(line)
    interruptOnToolUse(line)
    const request = line.request as Json | undefined
    if (
      line.type === "control_request" &&
      request?.subtype === "can_use_tool"
    ) {
      if (!run.answerTogetherInReverse) {
        answer(line)
      } else {
        waiting.push(line)
        clearTimeout(waitTimer)
        if (waiting.length >= 2) answerWaiting()
        else waitTimer = setTimeout(answerWaiting, 5000)
      }
    }
    if (line.type === "result") sendNextPrompt()
  })

  send({
    type: "control_request",
    request_id: "initialize-1",
    request: { subtype: "initialize" },
  })
  sendNextPrompt()

  return new Promise((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", () => {
      clearTimeout(settleTimer)
      resolve(envelopes)
    })
  })
}

function sanitise(envelopes: Envelope[]): Envelope[] {
  const home = homedir()
  const replacePaths = (text: string) =>
    text
      .replace(/\/(?:private\/)?tmp\/claude-\d+\//g, "/tmp/claude/")
      .replaceAll(home, "/home/user")
  return envelopes.map(({ dir, line }) => {
    const copy = JSON.parse(replacePaths(JSON.stringify(line))) as Json
    if (copy.type === "system" && copy.subtype === "init") redactInit(copy)
    if (copy.type === "system" && copy.subtype === "commands_changed")
      copy.commands = []
    if (copy.type === "control_response") redactInitializeResponse(copy)
    return { dir, line: copy }
  })
}

function redactInit(init: Json) {
  for (const key of PERSONAL_INIT_LISTS)
    if (Array.isArray(init[key])) init[key] = []
  if (Array.isArray(init.tools))
    init.tools = init.tools.filter((tool) => !String(tool).startsWith("mcp__"))
  if (Array.isArray(init.mcp_servers)) {
    init.mcp_servers = init.mcp_servers.map((server: Json, index: number) => ({
      ...server,
      name: `server-${index + 1}`,
    }))
  }
  if (Array.isArray(init.memory_paths)) init.memory_paths = []
}

function redactInitializeResponse(line: Json) {
  const response = line.response as Json | undefined
  if (
    response?.request_id !== "initialize-1" ||
    typeof response.response !== "object"
  )
    return
  response.response = Object.fromEntries(
    Object.keys(response.response as Json).map((key) => [key, "<redacted>"])
  )
}

async function main() {
  const outDir = process.argv[2] ?? "server/protocol/fixtures"
  mkdirSync(outDir, { recursive: true })
  const only = process.argv.slice(3)
  for (const scenario of scenarios.filter(
    (s) => only.length === 0 || only.includes(s.name)
  )) {
    const workDir = join(FIXTURE_ROOT, scenario.name)
    rmSync(workDir, { recursive: true, force: true })
    mkdirSync(workDir, { recursive: true })
    writeFileSync(join(workDir, "notes.txt"), "alpha\nbeta\ngamma\n")
    let sessionId: string | undefined
    try {
      for (const [index, run] of scenario.runs.entries()) {
        const envelopes = await record(
          scenario,
          run,
          workDir,
          run.resumeFrom ? sessionId : undefined
        )
        const init = envelopes.find(
          (e) => e.line.type === "system" && e.line.subtype === "init"
        )
        sessionId = init ? String(init.line.session_id) : sessionId
        const suffix = scenario.runs.length > 1 ? `-${index + 1}` : ""
        const file = join(outDir, `${scenario.name}${suffix}.jsonl`)
        writeFileSync(
          file,
          sanitise(envelopes)
            .map((e) => JSON.stringify(e))
            .join("\n") + "\n"
        )
        console.log(`${file}: ${envelopes.length} lines`)
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

await main()
