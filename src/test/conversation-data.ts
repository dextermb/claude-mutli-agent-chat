import type {
  Conversation,
  ConversationAgent,
  SessionCard,
  TimelineEntry,
} from "@/lib/agent-api"

export const testRunner: ConversationAgent = {
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
  description: null,
  maxTurns: null,
  sleepAfterMinutes: null,
  createdAt: "2026-11-15T10:00:00.000Z",
  state: "idle",
  sessionCwd: "/home/user/code/web-app",
}

export const directMessage: Conversation = {
  id: "c1",
  kind: "dm",
  name: "test-runner",
  topic: null,
  private: true,
  replyMode: "every",
  cwd: null,
  sleepAfterMinutes: null,
  members: ["user:me", "agent:a1"],
  createdAt: "2026-11-15T10:00:00.000Z",
}

export function localTime(day: number, hours: number, minutes: number) {
  return new Date(2026, 10, day, hours, minutes).toISOString()
}

export const userMessage: TimelineEntry = {
  id: "u1",
  seq: 1,
  authorKey: "user:me",
  createdAt: localTime(15, 14, 3),
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
  createdAt: localTime(15, 14, 4),
  item: {
    kind: "message",
    id: "item-1",
    text: "I will use a fixed clock.",
    status: "done",
  },
}

function agentEntry(seq: number, item: TimelineEntry["item"]): TimelineEntry {
  return {
    id: `s1/${item.id}`,
    seq,
    authorKey: "agent:a1",
    createdAt: localTime(15, 14, 5),
    item,
  }
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
  parentToolUseId: null,
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
  parentToolUseId: null,
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
  parentToolUseId: null,
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
  parentToolUseId: null,
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
  parentToolUseId: null,
})

export const stoppedCall = agentEntry(7, {
  kind: "tool_call",
  id: "item-6",
  toolUseId: "toolu_ping",
  name: "Bash",
  input: { command: "ping -c 30 127.0.0.1" },
  status: "stopped",
  result: null,
  decision: null,
  job: null,
  parentToolUseId: null,
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

export const limitTurn = agentEntry(10, {
  kind: "turn",
  id: "item-9",
  status: "limit",
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

export const reviewerBot: ConversationAgent = {
  ...testRunner,
  id: "a2",
  name: "reviewer-bot",
  colour: "orange",
  state: "idle",
}

export const releaseChannel: Conversation = {
  id: "ch1",
  kind: "channel",
  name: "release-train",
  topic: "Ship v2.4 on Friday.",
  private: false,
  replyMode: "mention",
  cwd: null,
  sleepAfterMinutes: null,
  members: ["user:me", "agent:a1", "agent:a2"],
  createdAt: "2026-11-15T09:00:00.000Z",
}

export const squadGroup: Conversation = {
  id: "g1",
  kind: "group",
  name: "reviewer-bot, test-runner",
  topic: null,
  private: true,
  replyMode: "mention",
  cwd: null,
  sleepAfterMinutes: null,
  members: ["user:me", "agent:a2", "agent:a1"],
  createdAt: "2026-11-15T09:30:00.000Z",
}

export const agentCall = agentEntry(12, {
  kind: "tool_call",
  id: "item-12",
  toolUseId: "toolu_agent",
  name: "Agent",
  input: {
    description: "Read notes.txt first line",
    prompt: "Read notes.txt and report its first line.",
    subagent_type: "general-purpose",
  },
  status: "done",
  result: null,
  decision: null,
  job: null,
  parentToolUseId: null,
})

export const subagentRead = agentEntry(13, {
  kind: "tool_call",
  id: "item-13",
  toolUseId: "toolu_subagent_read",
  name: "Read",
  input: { file_path: "/home/user/code/web-app/src/notes.txt" },
  status: "done",
  result: null,
  decision: null,
  job: null,
  parentToolUseId: "toolu_agent",
})

export const rateLimitNotice = agentEntry(14, {
  kind: "notice",
  id: "item-14",
  reason: "rate_limit",
  status: "rejected",
  rateLimitType: "five_hour",
  resetsAt: new Date(localTime(15, 14, 0)).getTime() / 1000,
})

export const failedNotice = agentEntry(15, {
  kind: "notice",
  id: "exit",
  reason: "failed",
  status: "failed",
  exitCode: 1,
  stderr: "Error: the SessionStart hook failed\n    at hook.js:4\n",
})

export const testRunnerSession: SessionCard = {
  claudeSessionId: "4f1c9a2e-7b3d-4e5f-8a6b-1c2d3e4f5a6b",
  state: "idle",
  model: "claude-sonnet-5-5",
  permissionMode: "acceptEdits",
  directory: "~/code/web-app",
  allowedTools: ["Read", "Bash(pnpm test:*)"],
  turns: 7,
  costUsd: 0.18,
  context: { used: 62_400, window: 200_000 },
  asleepSince: null,
  lastCompaction: null,
  configChanged: false,
}

export const sessionStart = agentEntry(16, {
  kind: "session_start",
  id: "start",
  status: "done",
  claudeSessionId: "4f1c9a2e-7b3d-4e5f-8a6b-1c2d3e4f5a6b",
})

export const compaction = agentEntry(17, {
  kind: "compaction",
  id: "item-30",
  status: "done",
  trigger: "manual",
  preTokens: 39_857,
  postTokens: 11_894,
  summary:
    "This session is being continued from a previous conversation.\n\nSummary:\n1. The user asked me to remember the word kiwi.",
})
