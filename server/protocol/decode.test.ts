import { describe, expect, test } from "vitest"
import { stdoutLines } from "../test/fixtures.ts"
import { decodeLine, type DecodedLine } from "./decode.ts"

function decodeFixture(name: string): DecodedLine[] {
  return stdoutLines(name).map(decodeLine)
}

function firstOfKind<K extends DecodedLine["kind"]>(
  lines: DecodedLine[],
  kind: K
): Extract<DecodedLine, { kind: K }> {
  const line = lines.find((candidate) => candidate.kind === kind)
  if (!line) throw new Error(`No ${kind} line`)
  return line as Extract<DecodedLine, { kind: K }>
}

describe("decodeLine", () => {
  test("a line that is not JSON decodes as invalid and keeps its text", () => {
    expect(decodeLine("Error: not json {")).toEqual({
      kind: "invalid",
      text: "Error: not json {",
    })
  })

  test("a line of a kind that the app does not read decodes as unknown and keeps the object", () => {
    const text =
      '{"type":"system","subtype":"hook_started","hook_event":"SessionStart","hook_name":"SessionStart:startup"}'

    expect(decodeLine(text)).toEqual({
      kind: "unknown",
      raw: {
        type: "system",
        subtype: "hook_started",
        hook_event: "SessionStart",
        hook_name: "SessionStart:startup",
      },
    })
  })

  test("the init line gives the session id, model, mode, folder and version", () => {
    expect(firstOfKind(decodeFixture("tools"), "init")).toEqual({
      kind: "init",
      sessionId: "074f7c64-3c94-4c49-8714-412f5e85ada2",
      model: "claude-haiku-5-5",
      permissionMode: "default",
      cwd: "/private/tmp/claude-fixture/tools",
      claudeCodeVersion: "2.1.311",
      tools: expect.arrayContaining(["Bash", "Read", "Write", "Edit"]),
    })
  })

  test("an assistant tool call gives the tool id, name and input", () => {
    const calls = decodeFixture("tools").filter(
      (line) =>
        line.kind === "assistant" &&
        line.blocks.some((block) => block.type === "tool_use")
    )

    expect(calls[0]).toEqual({
      kind: "assistant",
      uuid: "fb1f313a-3107-41d4-af62-75168a59a2da",
      parentToolUseId: null,
      blocks: [
        {
          type: "tool_use",
          id: "toolu_01QkS3JTeB3Ek8dm9x8AWLir",
          name: "Read",
          input: { file_path: "/private/tmp/claude-fixture/tools/notes.txt" },
        },
      ],
      model: "claude-haiku-5-5",
      contextTokens: 39_963,
    })
  })

  test("an assistant text block gives the text that the agent wrote", () => {
    const reply = decodeFixture("tools").find(
      (line) =>
        line.kind === "assistant" &&
        line.uuid === "0ee8726e-a8d7-4f12-a62d-680989f6e70f"
    )

    expect(reply).toMatchObject({
      blocks: [
        {
          type: "text",
          text: "Steps 1 to 6 ran, but `missing.txt` does not exist, and you denied the `rm` of `notes.txt`, so that file still exists with `BETA` in it.",
        },
      ],
    })
  })

  test("a tool result gives the call id, the output, the structured result and the decision", () => {
    expect(firstOfKind(decodeFixture("tools"), "tool_results")).toEqual({
      kind: "tool_results",
      uuid: "19c3eca6-fe4f-4353-b3ea-bc396fc94cfc",
      parentToolUseId: null,
      results: [
        {
          toolUseId: "toolu_01QkS3JTeB3Ek8dm9x8AWLir",
          isError: false,
          content: "1\talpha\n2\tbeta\n3\tgamma\n4\t",
          structured: expect.objectContaining({
            file: expect.objectContaining({ numLines: 4 }),
          }),
          decision: { decision: "accept", source: "config" },
        },
      ],
    })
  })

  test("the echo of a prompt gives its uuid and text", () => {
    expect(firstOfKind(decodeFixture("question"), "prompt_echo")).toEqual({
      kind: "prompt_echo",
      uuid: "19a387d5-6f0e-40dd-a622-5f801d6673d8",
      text:
        "Use the AskUserQuestion tool to ask me one question: which colour I prefer, " +
        "with the options Red and Blue. Then reply in one sentence that names my answer.",
    })
  })

  test("the text pieces of a streamed answer join to the text of the answer", () => {
    const lines = decodeFixture("interrupt")
    const pieces = lines.filter((line) => line.kind === "text_delta")
    const answer = lines
      .flatMap((line) => (line.kind === "assistant" ? line.blocks : []))
      .find((block) => block.type === "text")

    expect(pieces).toHaveLength(26)
    expect(pieces[0]).toEqual({
      kind: "text_delta",
      index: 1,
      text: "#",
      parentToolUseId: null,
    })
    expect(pieces.map((piece) => piece.text).join("")).toBe(answer?.text)
  })

  test("a permission request gives the request id, the tool, its input and the suggestions", () => {
    expect(firstOfKind(decodeFixture("tools"), "permission_request")).toEqual({
      kind: "permission_request",
      requestId: "397f44da-f197-43eb-9366-59857e2bfb6d",
      toolName: "Edit",
      toolUseId: "toolu_019iScCjJs6DMS6gsgz5x8Sw",
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
    })
  })

  test.each([
    {
      fixture: "tools",
      result: {
        kind: "result",
        subtype: "success",
        isError: false,
        terminalReason: "completed",
        durationMs: 9161,
        numTurns: 7,
        totalCostUsd: 0.01164317,
        contextWindows: { "claude-haiku-5-5": 1_000_000 },
        sessionId: "074f7c64-3c94-4c49-8714-412f5e85ada2",
        permissionDenials: [
          { toolName: "Bash", toolUseId: "toolu_01E4tqR95AiboUZk2gyU639w" },
        ],
      },
    },
    {
      fixture: "interrupt",
      result: {
        kind: "result",
        subtype: "error_during_execution",
        isError: true,
        terminalReason: "aborted_streaming",
        durationMs: 24385,
        numTurns: 2,
        totalCostUsd: 0,
        contextWindows: {},
        sessionId: "5d2cb421-09e3-48c6-b8f9-cf45c8763482",
        permissionDenials: [],
      },
    },
  ])(
    "the result line of the $fixture fixture gives the outcome, time, turns, cost and denials",
    ({ fixture, result }) => {
      expect(firstOfKind(decodeFixture(fixture), "result")).toEqual(result)
    }
  )

  test("a background job gives its start, then its status until it completes", () => {
    const tasks = decodeFixture("background").filter(
      (line) => line.kind === "task"
    )

    expect(tasks).toEqual([
      {
        kind: "task",
        event: "started",
        taskId: "bmsvbye28",
        toolUseId: "toolu_01WzDRH2iq1KvX6FBgQFyPHH",
        taskType: "local_bash",
        description: "Sleep 3 seconds then echo finished, in background",
        status: null,
      },
      expect.objectContaining({
        event: "updated",
        taskId: "bmsvbye28",
        status: "completed",
      }),
      expect.objectContaining({
        event: "notification",
        taskId: "bmsvbye28",
        toolUseId: "toolu_01WzDRH2iq1KvX6FBgQFyPHH",
        status: "completed",
      }),
    ])
  })

  test("a compaction gives its status, its result, its boundary with the tokens, and its summary", () => {
    const lines = decodeFixture("compact")

    expect(
      lines.filter(
        (line) =>
          line.kind === "compaction_status" || line.kind === "compact_boundary"
      )
    ).toEqual([
      { kind: "compaction_status", status: "requesting", compactResult: null },
      { kind: "compaction_status", status: "compacting", compactResult: null },
      { kind: "compaction_status", status: null, compactResult: "success" },
      {
        kind: "compact_boundary",
        trigger: "manual",
        preTokens: 39857,
        postTokens: 11894,
      },
      { kind: "compaction_status", status: "requesting", compactResult: null },
    ])
    expect(firstOfKind(lines, "synthetic_text").text).toMatch(
      /^This session is being continued from a previous conversation/
    )
  })

  test("a rate limit line gives its status, its window and when it resets", () => {
    expect(firstOfKind(decodeFixture("tools"), "rate_limit")).toEqual({
      kind: "rate_limit",
      status: "allowed",
      rateLimitType: "five_hour",
      resetsAt: 1794751800,
    })
  })

  test("the lines of a subagent name the Agent call that started it", () => {
    const lines = decodeFixture("subagent")
    const agentCall = lines
      .flatMap((line) => (line.kind === "assistant" ? line.blocks : []))
      .find((block) => block.type === "tool_use" && block.name === "Agent")
    const subagentLines = lines.filter(
      (line) =>
        (line.kind === "assistant" || line.kind === "tool_results") &&
        line.parentToolUseId !== null
    )

    expect(subagentLines.map((line) => line.kind)).toEqual([
      "assistant",
      "tool_results",
    ])
    expect(
      subagentLines.every(
        (line) =>
          agentCall?.type === "tool_use" &&
          "parentToolUseId" in line &&
          line.parentToolUseId === agentCall.id
      )
    ).toBe(true)
  })

  test.each([
    "tools",
    "question",
    "interrupt",
    "resume-1",
    "resume-2",
    "background",
    "subagent",
  ])("each recorded line of the %s fixture decodes", (fixture) => {
    expect(
      decodeFixture(fixture).filter((line) => line.kind === "invalid")
    ).toEqual([])
  })

  test("the echo of a permission answer gives the request id, the behaviour and the rules", () => {
    const answers = decodeFixture("tools").filter(
      (line) => line.kind === "permission_answer"
    )

    expect(
      answers.map(({ requestId, behavior, updatedPermissions }) => ({
        requestId,
        behavior,
        updatedPermissions,
      }))
    ).toEqual([
      {
        requestId: "397f44da-f197-43eb-9366-59857e2bfb6d",
        behavior: "allow",
        updatedPermissions: [],
      },
      {
        requestId: "05dc0f3b-6b1b-4ec3-8c0b-36236200c5a6",
        behavior: "deny",
        updatedPermissions: [],
      },
      {
        requestId: "c942ece4-4263-4c70-9297-c0034666a163",
        behavior: "allow",
        updatedPermissions: [
          { type: "setMode", mode: "acceptEdits", destination: "session" },
        ],
      },
    ])
  })
})
