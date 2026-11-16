import { describe, expect, test } from "vitest"
import { decodeLine, type DecodedLine } from "../protocol/decode.ts"
import { stdoutLines } from "../test/fixtures.ts"
import {
  emptyTimeline,
  reduceTimeline,
  type TimelineItem,
  type TimelineStep,
} from "./reduce.ts"

type ReplayStep = TimelineStep & { line: DecodedLine }

function steps(name: string): ReplayStep[] {
  let state = emptyTimeline()
  return stdoutLines(name).map((text) => {
    const line = decodeLine(text)
    const step = reduceTimeline(state, line)
    state = step.state
    return { ...step, line }
  })
}

function replay(name: string): TimelineItem[] {
  return steps(name).at(-1)?.state.items ?? []
}

function ofKind<K extends TimelineItem["kind"]>(
  items: TimelineItem[],
  kind: K
): Extract<TimelineItem, { kind: K }>[] {
  return items.filter(
    (item): item is Extract<TimelineItem, { kind: K }> => item.kind === kind
  )
}

function rateLimitLine(status: string): DecodedLine {
  const recorded = stdoutLines("question").find((text) =>
    text.includes('"type":"rate_limit_event"')
  )
  const line = JSON.parse(recorded ?? "{}") as {
    rate_limit_info: Record<string, unknown>
  }
  line.rate_limit_info.status = status
  return decodeLine(JSON.stringify(line))
}

function toolCall(items: TimelineItem[], toolUseId: string) {
  return items.find(
    (item) => item.kind === "tool_call" && item.toolUseId === toolUseId
  )
}

describe("reduceTimeline", () => {
  test("a Read call and its result give one tool call that shows the line count", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_01QkS3JTeB3Ek8dm9x8AWLir")).toMatchObject({
      kind: "tool_call",
      name: "Read",
      input: { file_path: "/private/tmp/claude-fixture/tools/notes.txt" },
      status: "done",
      result: { kind: "lines", count: 4 },
    })
  })

  test("an Edit gives a diff with one line added and one removed", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_019iScCjJs6DMS6gsgz5x8Sw")).toMatchObject({
      name: "Edit",
      status: "done",
      result: { kind: "diff", added: 1, removed: 1 },
    })
  })

  test("an Edit keeps the lines of its diff, with the kind of each line", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_019iScCjJs6DMS6gsgz5x8Sw")).toMatchObject({
      result: {
        lines: [
          { kind: "same", text: "alpha" },
          { kind: "remove", text: "beta" },
          { kind: "add", text: "BETA" },
          { kind: "same", text: "gamma" },
        ],
        more: 0,
      },
    })
  })

  test("a Write of a new file keeps each line of the file as an added line", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_01HBsBRQtD8ZZUUCTm5G4hhu")).toMatchObject({
      result: { lines: [{ kind: "add", text: "done" }], more: 0 },
    })
  })

  test("a diff keeps its first 200 lines, and counts the lines that it drops", () => {
    const write = decodeLine(
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_big", content: "ok" },
          ],
        },
        tool_use_result: {
          type: "create",
          filePath: "/tmp/big.txt",
          content: Array.from({ length: 250 }, (_, i) => `line ${i + 1}`).join(
            "\n"
          ),
        },
      })
    )
    const call = decodeLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "toolu_big", name: "Write", input: {} },
          ],
        },
      })
    )
    const state = reduceTimeline(emptyTimeline(), call).state
    const result = reduceTimeline(state, write).state.items[0]

    expect(result).toMatchObject({
      result: { kind: "diff", added: 250, removed: 0, more: 50 },
    })
    expect(
      result.kind === "tool_call" && result.result?.kind === "diff"
        ? result.result.lines?.at(-1)
        : null
    ).toEqual({ kind: "add", text: "line 200" })
  })

  test("a Write of a new file gives a diff that adds each line of the file", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_01HBsBRQtD8ZZUUCTm5G4hhu")).toMatchObject({
      name: "Write",
      status: "done",
      result: { kind: "diff", added: 1, removed: 0 },
    })
  })

  test("a turn keeps how full the context is after the last request of the agent", () => {
    const turns = ofKind(replay("tools"), "turn")

    expect(turns.at(-1)?.context).toEqual({ used: 53_040, window: 1_000_000 })
  })

  test("a turn of a resumed session gets the context window of its model", () => {
    const turns = ofKind(replay("resume-1"), "turn")

    expect(turns.at(-1)?.context).toEqual({ used: 39_853, window: 1_000_000 })
  })

  test("a Bash call shows the output of the command", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_01N2xayX551MRaJBbgcK5dZe")).toMatchObject({
      name: "Bash",
      input: { command: "echo hello" },
      status: "done",
      result: { kind: "output", stdout: "hello", stderr: "" },
    })
  })

  test("a call that the user denied shows as an error with the reason", () => {
    const items = replay("tools")

    expect(toolCall(items, "toolu_01E4tqR95AiboUZk2gyU639w")).toMatchObject({
      name: "Bash",
      status: "error",
      result: { kind: "error", message: "The user denied this command." },
      decision: { decision: "reject", source: "user_reject" },
    })
  })

  test("text pieces show as one message that the final text then completes", () => {
    const finalText =
      "Steps 1 to 6 ran, but `missing.txt` does not exist, and you denied the `rm` of `notes.txt`, so that file still exists with `BETA` in it."
    const run = steps("tools")
    const lastPiece = run
      .filter((step) => step.line.kind === "text_delta")
      .at(-1)

    expect(lastPiece?.changes).toEqual([
      expect.objectContaining({
        kind: "message",
        status: "streaming",
        text: finalText,
      }),
    ])
    expect(ofKind(replay("tools"), "message")).toEqual([
      expect.objectContaining({ status: "done", text: finalText }),
    ])
  })

  test("a permission request shows an approval card that waits for the user", () => {
    const request = steps("tools").find(
      (step) =>
        step.line.kind === "permission_request" && step.line.toolName === "Edit"
    )

    expect(request?.changes).toEqual([
      expect.objectContaining({
        kind: "permission",
        requestId: "397f44da-f197-43eb-9366-59857e2bfb6d",
        toolUseId: "toolu_019iScCjJs6DMS6gsgz5x8Sw",
        toolName: "Edit",
        description: "notes.txt",
        input: {
          file_path: "/private/tmp/claude-fixture/tools/notes.txt",
          old_string: "beta",
          new_string: "BETA",
          replace_all: false,
        },
        suggestions: [
          { type: "setMode", mode: "acceptEdits", destination: "session" },
        ],
        status: "pending",
      }),
    ])
  })

  test("the answer of the user moves each approval card to allowed or denied", () => {
    const cards = ofKind(replay("tools"), "permission")

    expect(cards.map(({ toolName, status }) => ({ toolName, status }))).toEqual(
      [
        { toolName: "Edit", status: "allowed" },
        { toolName: "Bash", status: "denied" },
        { toolName: "Write", status: "allowed" },
      ]
    )
  })

  test("a question shows as one question card that keeps the answer of the user", () => {
    const items = replay("question")

    expect(ofKind(items, "tool_call")).toEqual([])
    expect(ofKind(items, "question")).toEqual([
      expect.objectContaining({
        requestId: "a5412e05-e9c5-4d15-98c7-0ce6e7f51f5b",
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
        status: "answered",
        answers: { "Which colour do you prefer?": "Red" },
      }),
    ])
  })

  test("the end of a turn adds a summary with the time, the cost and the turns", () => {
    expect(replay("tools").at(-1)).toMatchObject({
      kind: "turn",
      status: "done",
      durationMs: 9161,
      costUsd: 0.01164317,
      numTurns: 7,
    })
  })

  test("a turn that the user interrupted ends as stopped", () => {
    expect(replay("interrupt").at(-1)).toMatchObject({
      kind: "turn",
      status: "stopped",
    })
  })

  test("a compaction makes one item with its trigger, its tokens and its summary, and the next prompt runs as usual", () => {
    const items = replay("compact")

    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "turn",
      "compaction",
      "turn",
      "message",
      "turn",
    ])
    expect(ofKind(items, "compaction")).toEqual([
      {
        kind: "compaction",
        id: expect.any(String),
        status: "done",
        trigger: "manual",
        preTokens: 39857,
        postTokens: 11894,
        summary: expect.stringMatching(
          /^This session is being continued from a previous conversation/
        ),
      },
    ])
    expect(ofKind(items, "message").at(-1)?.text).toBe("kiwi")
  })

  test("an automatic compaction inside a turn makes an item with the trigger auto, its tokens and its summary", () => {
    const done = ofKind(replay("compact-auto"), "compaction").filter(
      (item) => item.status === "done"
    )

    expect(done).toHaveLength(4)
    expect(done[0]).toMatchObject({
      trigger: "auto",
      preTokens: 51547,
      postTokens: 15411,
      summary: expect.stringMatching(
        /^This session is being continued from a previous conversation/
      ),
    })
  })

  test("a compaction that fails ends as failed, and no compaction stays running", () => {
    const statuses = ofKind(replay("compact-auto"), "compaction").map(
      (item) => item.status
    )

    expect(statuses).toEqual([
      "failed",
      "failed",
      "done",
      "done",
      "done",
      "done",
    ])
  })

  test("the turn of a compaction gives no context, because the size is not known until the next request", () => {
    const turns = ofKind(replay("compact"), "turn")

    expect(turns[0].context).toBeDefined()
    expect(turns[1].context).toBeUndefined()
    expect(turns[2].context).toBeDefined()
  })

  test("a turn that reaches the turn limit ends at the limit, and the next prompt runs as usual", () => {
    const items = replay("max-turns")

    expect(ofKind(items, "turn")).toEqual([
      expect.objectContaining({ status: "limit", numTurns: 2 }),
      expect.objectContaining({ status: "done", numTurns: 1 }),
    ])
    expect(ofKind(items, "message").at(-1)?.text).toBe("ok")
  })

  test("a background job that ends after the turn starts a new turn with no prompt", () => {
    const items = replay("background")

    expect(items.map((item) => item.kind)).toEqual([
      "tool_call",
      "message",
      "turn",
      "message",
      "turn",
    ])
    expect(ofKind(items, "message").at(-1)?.text).toBe(
      "The background command finished with exit code 0."
    )
  })

  test("a tool call of a subagent names the Agent call that it belongs to", () => {
    const items = replay("subagent")

    expect(toolCall(items, "toolu_01N4sUJpcvkcd7HQqhvj9dhk")).toMatchObject({
      name: "Agent",
      parentToolUseId: null,
    })
    expect(toolCall(items, "toolu_01NDPJmX9RP42ecvoqNrzZ8w")).toMatchObject({
      name: "Read",
      parentToolUseId: "toolu_01N4sUJpcvkcd7HQqhvj9dhk",
    })
  })

  test("the text of a subagent never shows at the top level, because Claude Code does not send it", () => {
    const items = replay("subagent-text")

    expect(ofKind(items, "message").map((message) => message.text)).toEqual([
      "alpha",
    ])
    expect(toolCall(items, "toolu_01PiqqiZmJKQt7HHGAoUC7g2")).toMatchObject({
      name: "Read",
      parentToolUseId: "toolu_01CnuhAhoGPaxKgEYvwdPkU6",
    })
  })

  test("a rate limit that is reached adds one notice, and the same status again adds none", () => {
    const first = reduceTimeline(emptyTimeline(), rateLimitLine("rejected"))
    const second = reduceTimeline(first.state, rateLimitLine("rejected"))

    expect(first.changes).toEqual([
      {
        kind: "notice",
        id: "item-1",
        reason: "rate_limit",
        status: "rejected",
        rateLimitType: "five_hour",
        resetsAt: 1794751800,
      },
    ])
    expect(second.changes).toEqual([])
  })

  test("an interrupt while a tool runs stops the turn and the tool call, with no error text", () => {
    const items = replay("interrupt-tool")

    expect(ofKind(items, "turn")).toEqual([
      expect.objectContaining({ status: "stopped" }),
    ])
    expect(toolCall(items, "toolu_01PFqairxqQrsUe8rD6zsBaB")).toMatchObject({
      name: "Bash",
      status: "stopped",
      result: null,
    })
  })

  test("each turn shows its own cost, not the cost of the process so far", () => {
    const [first, second] = ofKind(replay("background"), "turn")

    expect(first.costUsd).toBeCloseTo(0.00843574, 10)
    expect(second.costUsd).toBeCloseTo(0.00068716, 10)
  })

  test("a background job shows its status on the tool call that started it", () => {
    const run = steps("background")
    const started = run.find(
      (step) => step.line.kind === "task" && step.line.event === "started"
    )

    expect(started?.changes).toEqual([
      expect.objectContaining({
        toolUseId: "toolu_01WzDRH2iq1KvX6FBgQFyPHH",
        job: { taskId: "bmsvbye28", status: "running" },
      }),
    ])
    expect(
      toolCall(replay("background"), "toolu_01WzDRH2iq1KvX6FBgQFyPHH")
    ).toMatchObject({
      status: "done",
      job: { taskId: "bmsvbye28", status: "completed" },
    })
  })
})
