import { afterEach, describe, expect, test, vi } from "vitest"
import { stdinLines } from "../test/fixtures.ts"
import type { TimelineItem } from "../timeline/reduce.ts"
import { AgentSession, type SessionEvent } from "./session.ts"

const FAKE_CLAUDE = new URL("../test/fake-claude.ts", import.meta.url).pathname

const running: AgentSession[] = []

afterEach(async () => {
  await Promise.all(running.splice(0).map((session) => session.stop()))
})

function startFake(
  fixture: string,
  mode = "play",
  env: NodeJS.ProcessEnv = process.env
) {
  const events: SessionEvent[] = []
  const session = new AgentSession({
    command: process.execPath,
    args: [FAKE_CLAUDE],
    cwd: process.cwd(),
    env: {
      ...env,
      FAKE_CLAUDE_FIXTURE: fixture,
      FAKE_CLAUDE_MODE: mode,
    },
    onEvent: (event) => events.push(event),
  })
  running.push(session)
  session.start()
  return { session, events }
}

function states(events: SessionEvent[]) {
  return events.flatMap((event) =>
    event.type === "state" ? [event.state] : []
  )
}

function claudeSessionIds(events: SessionEvent[]) {
  return events.flatMap((event) =>
    event.type === "claude_session" ? [event.claudeSessionId] : []
  )
}

function latestItems(events: SessionEvent[]) {
  const items = new Map<string, TimelineItem>()
  for (const event of events) {
    if (event.type !== "changes") continue
    for (const item of event.items) items.set(item.id, item)
  }
  return [...items.values()]
}

async function untilIdle(events: SessionEvent[], count: number) {
  await vi.waitFor(() =>
    expect(states(events).filter((state) => state === "idle")).toHaveLength(
      count
    )
  )
}

describe("AgentSession", () => {
  test("a new session is idle before Claude Code sends init, and init comes with the first prompt", async () => {
    const { session, events } = startFake("resume-1")

    await vi.waitFor(() => expect(states(events)).toEqual(["starting", "idle"]))
    expect(claudeSessionIds(events)).toEqual([])

    session.prompt("Remember the word kiwi. Reply with the single word ok.")

    await vi.waitFor(() =>
      expect(states(events)).toEqual(["starting", "idle", "busy", "idle"])
    )
    expect(claudeSessionIds(events)).toEqual([
      "7e27a04a-8178-4a22-aad9-d886c125c430",
    ])
  })

  test("a turn reports the timeline items that the agent made", async () => {
    const { session, events } = startFake("resume-1")
    await untilIdle(events, 1)

    session.prompt("Remember the word kiwi. Reply with the single word ok.")
    await untilIdle(events, 2)

    expect(latestItems(events)).toEqual([
      expect.objectContaining({ kind: "message", text: "ok", status: "done" }),
      expect.objectContaining({ kind: "turn", status: "done" }),
    ])
  })

  test("a session waits while a question is open, and works again after the answer", async () => {
    const { session, events } = startFake("question")
    await untilIdle(events, 1)

    session.prompt(
      "Use the AskUserQuestion tool to ask me one question: which colour I prefer, with the options Red and Blue. Then reply in one sentence that names my answer."
    )
    await vi.waitFor(() => expect(states(events)).toContain("waiting"))
    const question = latestItems(events).find(
      (item) => item.kind === "question"
    )
    session.answer(question?.requestId ?? "", {
      behavior: "allow",
      updatedInput: {
        questions: question?.kind === "question" ? question.questions : [],
        answers: { "Which colour do you prefer?": "Red" },
      },
    })
    await untilIdle(events, 2)

    expect(states(events)).toEqual([
      "starting",
      "idle",
      "busy",
      "waiting",
      "busy",
      "idle",
    ])
    expect(latestItems(events)).toContainEqual(
      expect.objectContaining({ kind: "question", status: "answered" })
    )
  })

  test("two tool calls in one message ask for permission one after the other", async () => {
    const { session, events } = startFake("two-requests")
    await untilIdle(events, 1)
    const pending = () =>
      latestItems(events).filter(
        (item) => item.kind === "permission" && item.status === "pending"
      )

    session.prompt(
      "In one message, make two Write tool calls in parallel: write a.txt that holds the word one, and write b.txt that holds the word two. Then reply in one short sentence."
    )
    for (const requestId of ["b5dd8886", "d0812ad4"]) {
      await vi.waitFor(() =>
        expect(pending()).toEqual([
          expect.objectContaining({
            requestId: expect.stringMatching(new RegExp(`^${requestId}`)),
          }),
        ])
      )
      const [card] = pending()
      session.answer(card.kind === "permission" ? card.requestId : "", {
        behavior: "allow",
        updatedInput: card.kind === "permission" ? card.input : {},
      })
    }
    await untilIdle(events, 2)

    expect(states(events)).toEqual([
      "starting",
      "idle",
      "busy",
      "waiting",
      "busy",
      "waiting",
      "busy",
      "idle",
    ])
  })

  test("an interrupt stops the turn and the session stays ready for the next prompt", async () => {
    const { session, events } = startFake("interrupt")
    await untilIdle(events, 1)

    session.prompt(
      "Write an 800-word story about a lighthouse. Do not use any tools."
    )
    await vi.waitFor(() => expect(states(events)).toContain("busy"))
    session.interrupt()
    await untilIdle(events, 2)

    expect(latestItems(events).at(-1)).toMatchObject({
      kind: "turn",
      status: "stopped",
    })
    expect(states(events).at(-1)).toBe("idle")
  })

  test("a session fails when Claude Code stops with an error", async () => {
    const { session, events } = startFake("resume-1", "crash")
    await untilIdle(events, 1)

    session.prompt("Remember the word kiwi. Reply with the single word ok.")

    await vi.waitFor(() =>
      expect(states(events)).toEqual(["starting", "idle", "busy", "failed"])
    )
  })

  test("a line that is not JSON is kept for storage and the turn continues", async () => {
    const { session, events } = startFake("resume-1", "not-json")
    await untilIdle(events, 1)

    session.prompt("Remember the word kiwi. Reply with the single word ok.")
    await untilIdle(events, 2)

    expect(events).toContainEqual({
      type: "line",
      direction: "out",
      text: "Warning: this line is not JSON",
    })
    expect(latestItems(events)).toContainEqual(
      expect.objectContaining({ kind: "message", text: "ok" })
    )
  })

  test("each line that the session sends is kept for storage", async () => {
    const { session, events } = startFake("resume-1")
    await untilIdle(events, 1)

    session.prompt("Remember the word kiwi. Reply with the single word ok.")
    await untilIdle(events, 2)

    const sent = events.flatMap((event) =>
      event.type === "line" && event.direction === "in"
        ? [JSON.parse(event.text)]
        : []
    )
    expect(sent).toEqual(stdinLines("resume-1"))
  })

  test("a stopped session reports that it exited", async () => {
    const { session, events } = startFake("resume-1")
    await untilIdle(events, 1)

    await session.stop()

    expect(states(events)).toEqual(["starting", "idle", "exited"])
  })

  test("the agent does not get the variables of a parent Claude Code session", async () => {
    const { session, events } = startFake("resume-1", "env", {
      PATH: process.env.PATH,
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "parent-session",
      CLAUDE_CODE_MESSAGING_TOKEN: "parent-token",
      CLAUDE_CODE_USE_BEDROCK: "1",
    })
    await untilIdle(events, 1)

    session.prompt("Remember the word kiwi. Reply with the single word ok.")
    await untilIdle(events, 2)

    expect(events).toContainEqual({
      type: "line",
      direction: "out",
      text: "env: CLAUDE_CODE_USE_BEDROCK",
    })
  })

  test("a prompt to a failed session is dropped and the session stays failed", async () => {
    const { session, events } = startFake("resume-1", "crash")
    await untilIdle(events, 1)
    session.prompt("Remember the word kiwi. Reply with the single word ok.")
    await vi.waitFor(() => expect(states(events)).toContain("failed"))

    session.prompt("Are you there?")
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(states(events)).toEqual(["starting", "idle", "busy", "failed"])
  })
})
