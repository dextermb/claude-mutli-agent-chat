import { describe, expect, test } from "vitest"
import { stdinLines, stdoutLines } from "../test/fixtures.ts"
import { decodeLine, type PermissionRequestLine } from "./decode.ts"
import {
  encodeInitialize,
  encodeInterrupt,
  encodePermissionAnswer,
  encodePrompt,
  type PermissionAnswer,
} from "./encode.ts"

function recordedInput(fixture: string, type: string, subtype?: string) {
  const line = stdinLines(fixture).find(
    (candidate) =>
      candidate.type === type &&
      (subtype === undefined ||
        (candidate.request as { subtype?: string } | undefined)?.subtype ===
          subtype)
  )
  if (!line) throw new Error(`No ${type} input in ${fixture}`)
  return line
}

describe("encoders", () => {
  test("a prompt is the user line that Claude Code accepted", () => {
    const text =
      "Use the AskUserQuestion tool to ask me one question: which colour I prefer, " +
      "with the options Red and Blue. Then reply in one sentence that names my answer."

    expect(JSON.parse(encodePrompt(text))).toEqual(
      recordedInput("question", "user")
    )
  })

  test("initialize is the control request that Claude Code answered", () => {
    expect(JSON.parse(encodeInitialize("initialize-1"))).toEqual(
      recordedInput("question", "control_request", "initialize")
    )
  })

  test("an interrupt is the control request that stopped the recorded turn", () => {
    expect(JSON.parse(encodeInterrupt("interrupt-1"))).toEqual(
      recordedInput("interrupt", "control_request", "interrupt")
    )
  })

  test.each<{
    button: string
    toolName: string
    answer: (request: PermissionRequestLine) => PermissionAnswer
  }>([
    {
      button: "Allow once",
      toolName: "Edit",
      answer: (request) => ({ behavior: "allow", updatedInput: request.input }),
    },
    {
      button: "Deny",
      toolName: "Bash",
      answer: () => ({
        behavior: "deny",
        message: "The user denied this command.",
      }),
    },
    {
      button: "Always allow",
      toolName: "Write",
      answer: (request) => ({
        behavior: "allow",
        updatedInput: request.input,
        updatedPermissions: request.suggestions,
      }),
    },
  ])(
    "$button on the $toolName request is the answer that Claude Code accepted",
    ({ toolName, answer }) => {
      const request = stdoutLines("tools")
        .map(decodeLine)
        .find(
          (line): line is PermissionRequestLine =>
            line.kind === "permission_request" && line.toolName === toolName
        )
      if (!request) throw new Error(`No ${toolName} request`)
      const recorded = stdinLines("tools").find(
        (line) =>
          line.type === "control_response" &&
          (line.response as { request_id?: string }).request_id ===
            request.requestId
      )

      expect(
        JSON.parse(encodePermissionAnswer(request.requestId, answer(request)))
      ).toEqual(recorded)
    }
  )
})
