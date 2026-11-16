import { describe, expect, test } from "vitest"

import { fileNote, filesOf } from "@/lib/files"
import type { TimelineEntry, ToolCallItem } from "@/lib/agent-api"

function call(
  seq: number,
  minutes: number,
  item: Partial<ToolCallItem> & Pick<ToolCallItem, "name" | "input">
): TimelineEntry {
  return {
    id: `s1/item-${seq}`,
    seq,
    authorKey: "agent:a1",
    createdAt: new Date(2026, 10, 15, 14, minutes).toISOString(),
    item: {
      kind: "tool_call",
      id: `item-${seq}`,
      toolUseId: `toolu_${seq}`,
      status: "done",
      result: null,
      decision: null,
      job: null,
      parentToolUseId: null,
      ...item,
    },
  }
}

const cwd = "/home/user/code/web-app"

describe("filesOf", () => {
  test("each file that the agent read or changed is one row, the newest first", () => {
    const entries = [
      call(1, 1, {
        name: "Read",
        input: { file_path: `${cwd}/notes.txt` },
        result: { kind: "lines", count: 4 },
      }),
      call(2, 2, {
        name: "Read",
        input: { file_path: `${cwd}/missing.txt` },
        status: "error",
        result: { kind: "error", message: "File does not exist." },
      }),
      call(3, 3, { name: "Bash", input: { command: "echo hello" } }),
      call(4, 4, {
        name: "Edit",
        input: { file_path: `${cwd}/notes.txt` },
        result: { kind: "diff", added: 1, removed: 1 },
      }),
      call(5, 6, {
        name: "Write",
        input: { file_path: `${cwd}/out.txt` },
        result: { kind: "diff", added: 1, removed: 0 },
      }),
    ]

    expect(filesOf(entries, cwd)).toEqual([
      {
        path: "out.txt",
        last: "Created",
        added: 1,
        removed: 0,
        createdAt: entries[4].createdAt,
        entryId: "s1/item-5",
      },
      {
        path: "notes.txt",
        last: "Edited",
        added: 1,
        removed: 1,
        createdAt: entries[3].createdAt,
        entryId: "s1/item-4",
      },
    ])
  })
})

describe("fileNote", () => {
  const path = "/data/uploads/c1/ci-log.txt"
  const names = (authorKey: string) =>
    authorKey === "agent:a1" ? "test-runner" : "reviewer-bot"

  test("a shared file that no agent touched says so", () => {
    expect(fileNote(path, [], 0, names)).toBe("No agent read it yet.")
  })

  test("the last change after the message wins over a read, and names the agent and the time", () => {
    const entries = [
      call(1, 1, { name: "Edit", input: { file_path: path } }),
      call(5, 4, { name: "Read", input: { file_path: path } }),
      call(6, 5, { name: "Write", input: { file_path: path } }),
      call(7, 6, { name: "Read", input: { file_path: "/other.txt" } }),
    ]

    expect(fileNote(path, entries, 2, names)).toBe(
      "Edited by test-runner at 14:05"
    )
    expect(fileNote(path, entries.slice(0, 2), 2, names)).toBe(
      "Read by test-runner at 14:04"
    )
  })
})
