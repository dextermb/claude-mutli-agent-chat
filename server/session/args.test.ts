import { readFileSync } from "node:fs"
import { isAbsolute, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { buildArgs, type AgentConfig } from "./args.ts"

const AGENT_FOLDER = fileURLToPath(new URL("../../agent", import.meta.url))

const RULE = "# This session\n\nYou are reviewer-bot."

const reviewer: AgentConfig = {
  model: "claude-haiku-5-5",
  permissionMode: "default",
  allowedTools: [],
  disallowedTools: [],
  systemPrompt: null,
}

function flagValues(args: string[], flag: string): string[] {
  const start = args.indexOf(flag)
  if (start === -1) return []
  const rest = args.slice(start + 1)
  const end = rest.findIndex((arg) => arg.startsWith("-"))
  return end === -1 ? rest : rest.slice(0, end)
}

describe("buildArgs", () => {
  test("a new session gets the stream-json command line with the model and the mode", () => {
    expect(buildArgs(reviewer, { claudeSessionId: null }, RULE)).toEqual([
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
      "--plugin-dir",
      AGENT_FOLDER,
      "--model",
      "claude-haiku-5-5",
      "--permission-mode",
      "default",
      "--append-system-prompt",
      "# This session\n\nYou are reviewer-bot.",
    ])
  })

  test("a session with a Claude session id resumes that session", () => {
    const args = buildArgs(
      reviewer,
      {
        claudeSessionId: "074f7c64-3c94-4c49-8714-412f5e85ada2",
      },
      RULE
    )

    expect(args.slice(-2)).toEqual([
      "--resume",
      "074f7c64-3c94-4c49-8714-412f5e85ada2",
    ])
  })

  test("a new Claude session id that has had no turn starts with that id, not with resume", () => {
    const args = buildArgs(
      reviewer,
      {
        claudeSessionId: "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
        claudeSessionNew: true,
      },
      RULE
    )

    expect(args.slice(-2)).toEqual([
      "--session-id",
      "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
    ])
    expect(args).not.toContain("--resume")
  })

  test("the allowed and the disallowed tool rules of the agent each get a flag", () => {
    const args = buildArgs(
      {
        ...reviewer,
        allowedTools: ["Read", "Bash(git *)"],
        disallowedTools: ["WebFetch"],
      },
      { claudeSessionId: null },
      RULE
    )

    expect(flagValues(args, "--allowedTools")).toEqual(["Read", "Bash(git *)"])
    expect(flagValues(args, "--disallowedTools")).toEqual(["WebFetch"])
  })

  test("the system prompt of the agent goes after the rule of the environment", () => {
    const args = buildArgs(
      { ...reviewer, systemPrompt: "You review pull requests." },
      { claudeSessionId: null },
      RULE
    )

    expect(flagValues(args, "--append-system-prompt")).toEqual([
      "# This session\n\nYou are reviewer-bot.\n\nYou review pull requests.",
    ])
  })

  test("each session loads the chat plugin of the repository", () => {
    const [folder] = flagValues(
      buildArgs(reviewer, { claudeSessionId: null }, RULE),
      "--plugin-dir"
    )

    expect(isAbsolute(folder)).toBe(true)
    expect(
      JSON.parse(
        readFileSync(join(folder, ".claude-plugin", "plugin.json"), "utf8")
      )
    ).toMatchObject({ name: "chat" })
  })
})
