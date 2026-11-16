import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { claudeSummarizer } from "./summarizer.ts"

const FAKE = new URL("../test/fake-summarizer.ts", import.meta.url).pathname
const folders: string[] = []

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true })
  }
})

function fake(mode = "play", timeoutMs?: number) {
  const folder = mkdtempSync(join(tmpdir(), "summarizer-test-"))
  folders.push(folder)
  const log = join(folder, "log.json")
  const summarize = claudeSummarizer({
    command: process.execPath,
    commandArgs: [FAKE],
    cwd: folder,
    timeoutMs,
    env: {
      ...process.env,
      FAKE_SUMMARIZER_MODE: mode,
      FAKE_SUMMARIZER_LOG: log,
    },
  })
  const received = () =>
    JSON.parse(readFileSync(log, "utf8")) as { args: string[]; input: string }
  return { summarize, received }
}

describe("claudeSummarizer", () => {
  test("it runs claude with no tools and no user settings, and gives the summary and its cost", async () => {
    const { summarize, received } = fake()

    const summary = await summarize({
      earlier: "- PR 212 is open.",
      lines: ["[User] One.", "[reviewer-bot] Two."],
    })

    expect(summary?.text).toMatch(/^- \*\*Task:\*\* Review PR 212/)
    expect(summary?.costUsd).toBe(0.00028890000000000003)
    const { args, input } = received()
    expect(args.slice(0, -1)).toEqual([
      "-p",
      "--output-format",
      "json",
      "--setting-sources",
      "project",
      "--strict-mcp-config",
      "--tools",
      "",
      "--disable-slash-commands",
      "--model",
      "haiku",
      "--no-session-persistence",
      "--system-prompt",
    ])
    expect(args.at(-1)).toMatch(/^You write the summary of a chat conversation/)
    expect(input).toBe(
      "Earlier summary:\n- PR 212 is open.\n\nMessages:\n[User] One.\n[reviewer-bot] Two.\n"
    )
  })

  test("a run that fails or takes too long gives no summary", async () => {
    const failed = fake("fail")
    const slow = fake("hang", 200)
    const input = { earlier: null, lines: ["[User] One."] }

    const started = Date.now()
    const results = await Promise.all([
      failed.summarize(input),
      slow.summarize(input),
    ])

    expect(results).toEqual([null, null])
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
