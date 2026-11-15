import type {
  AgentWithState,
  Conversation,
  TimelineEntry,
} from "@/lib/agent-api"

export const testRunner: AgentWithState = {
  id: "a1",
  name: "test-runner",
  colour: "aqua",
  model: "claude-sonnet-5-5",
  permissionMode: "acceptEdits",
  cwd: "/home/user/code/web-app",
  autostart: false,
  allowedTools: ["Read", "Bash(pnpm test:*)"],
  disallowedTools: [],
  systemPrompt: null,
  createdAt: "2026-11-15T10:00:00.000Z",
  state: "idle",
}

export const directMessage: Conversation = {
  id: "c1",
  kind: "dm",
  name: "test-runner",
  topic: null,
  private: true,
  replyMode: "every",
  members: ["user:me", "agent:a1"],
  createdAt: "2026-11-15T10:00:00.000Z",
}

export const userMessage: TimelineEntry = {
  id: "u1",
  seq: 1,
  authorKey: "user:me",
  item: {
    kind: "message",
    id: "u1",
    text: "Fix the flaky auth test.",
    status: "done",
  },
}

export const agentMessage: TimelineEntry = {
  id: "s1/item-1",
  seq: 2,
  authorKey: "agent:a1",
  item: {
    kind: "message",
    id: "item-1",
    text: "I will use a fixed clock.",
    status: "done",
  },
}

function agentEntry(seq: number, item: TimelineEntry["item"]): TimelineEntry {
  return { id: `s1/${item.id}`, seq, authorKey: "agent:a1", item }
}

export const readCall = agentEntry(3, {
  kind: "tool_call",
  id: "item-2",
  toolUseId: "toolu_read",
  name: "Read",
  input: { file_path: "/home/user/code/web-app/src/notes.txt" },
  status: "done",
  result: { kind: "lines", count: 4 },
  decision: null,
  job: null,
})

export const editCall = agentEntry(4, {
  kind: "tool_call",
  id: "item-3",
  toolUseId: "toolu_edit",
  name: "Edit",
  input: {
    file_path: "/home/user/code/web-app/src/notes.txt",
    old_string: "beta",
    new_string: "BETA",
  },
  status: "done",
  result: { kind: "diff", added: 1, removed: 1 },
  decision: null,
  job: null,
})

export const bashCall = agentEntry(5, {
  kind: "tool_call",
  id: "item-4",
  toolUseId: "toolu_echo",
  name: "Bash",
  input: { command: "echo hello" },
  status: "done",
  result: { kind: "output", stdout: "hello", stderr: "" },
  decision: null,
  job: null,
})

export const deniedCall = agentEntry(6, {
  kind: "tool_call",
  id: "item-5",
  toolUseId: "toolu_rm",
  name: "Bash",
  input: { command: "rm src/notes.txt" },
  status: "error",
  result: { kind: "error", message: "The user denied this." },
  decision: { decision: "reject", source: "user_reject" },
  job: null,
})

export const pushCall = agentEntry(7, {
  kind: "tool_call",
  id: "item-6",
  toolUseId: "toolu_push",
  name: "Bash",
  input: { command: "git push origin release-train" },
  status: "running",
  result: null,
  decision: null,
  job: null,
})

export const pushRequest = agentEntry(8, {
  kind: "permission",
  id: "item-7",
  requestId: "r1",
  toolUseId: "toolu_push",
  toolName: "Bash",
  description: "Push the branch",
  input: { command: "git push origin release-train" },
  suggestions: [
    {
      type: "addRules",
      rules: [{ toolName: "Bash", ruleContent: "git push:*" }],
      behavior: "allow",
      destination: "localSettings",
    },
  ],
  status: "pending",
})

export const colourQuestion = agentEntry(9, {
  kind: "question",
  id: "item-8",
  requestId: "q1",
  toolUseId: "toolu_ask",
  questions: [
    {
      question: "Which colour do you prefer?",
      header: "Colour",
      options: [
        { label: "Red", description: "Choose red." },
        { label: "Blue", description: "Choose blue." },
      ],
      multiSelect: false,
    },
  ],
  status: "pending",
  answers: null,
})

export const finishedTurn = agentEntry(10, {
  kind: "turn",
  id: "item-9",
  status: "done",
  durationMs: 9161,
  costUsd: 0.01164317,
  numTurns: 7,
})

export const stoppedTurn = agentEntry(11, {
  kind: "turn",
  id: "item-10",
  status: "stopped",
  durationMs: 24385,
  costUsd: 0,
  numTurns: 2,
})
