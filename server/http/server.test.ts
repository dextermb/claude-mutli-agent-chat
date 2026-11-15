import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  agentStates,
  answerRequest,
  cleanups,
  nextPendingCard,
  openEvents,
  postJson,
  runCleanups,
  sendMessage,
  startServer,
  streamedItems,
  testRunner,
  timeline,
} from "../test/http.ts"

afterEach(runCleanups)

describe("createServer", () => {
  test("a message that the user sends is stored and shows in the timeline", async () => {
    const { base, conversation } = await startServer()

    const response = await sendMessage(
      base,
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )

    expect(response.status).toBe(202)
    expect((await timeline(base, conversation.id)).items[0]).toMatchObject({
      authorKey: "user:me",
      item: {
        kind: "message",
        text: "Remember the word kiwi. Reply with the single word ok.",
      },
    })
  })

  test("the server refuses an empty message and stores nothing", async () => {
    const { base, started, conversation } = await startServer()

    const response = await sendMessage(base, conversation.id, "  \n ")

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Write a message." })
    expect((await timeline(base, conversation.id)).items).toEqual([])
    expect(started).toHaveLength(0)
  })

  test("a message starts the agent, and the reply of the agent shows in the timeline", async () => {
    const { base, agent, conversation } = await startServer()

    await sendMessage(
      base,
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items.map(({ authorKey, item }) => [authorKey, item.kind, item.text])
      ).toEqual([
        [
          "user:me",
          "message",
          "Remember the word kiwi. Reply with the single word ok.",
        ],
        [`agent:${agent.id}`, "message", "ok"],
        [`agent:${agent.id}`, "turn", undefined],
      ])
    })
  })

  test("a process that fails adds a notice with its stderr, and its session keeps the exit", async () => {
    const { base, store, agent, conversation } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ mode: "crash" })
    )

    await sendMessage(base, conversation.id, "Hello.")

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(items.map(({ item }) => item)).toEqual([
        expect.objectContaining({ kind: "message", text: "Hello." }),
        {
          kind: "notice",
          id: "exit",
          reason: "failed",
          status: "failed",
          exitCode: 1,
          stderr: "fake claude (crash): crash on the first prompt\n",
        },
      ])
    })
    expect(store.latestSession(agent.id, conversation.id)).toMatchObject({
      state: "failed",
      exitCode: 1,
      stderr: "fake claude (crash): crash on the first prompt\n",
      endedAt: expect.stringMatching(/^2\d{3}-/),
    })
  })

  test("a message to an agent with a stored Claude session resumes that session", async () => {
    const { base, store, started, agent, conversation } = await startServer()
    const earlier = store.createSession({
      agentId: agent.id,
      conversationId: conversation.id,
    })
    store.updateSession(earlier.id, {
      claudeSessionId: "7e27a04a-8178-4a22-aad9-d886c125c430",
      state: "exited",
    })

    await sendMessage(base, conversation.id, "What was the word?")

    expect(started).toHaveLength(1)
    expect(started[0].slice(-2)).toEqual([
      "--resume",
      "7e27a04a-8178-4a22-aad9-d886c125c430",
    ])
  })

  test("a resumed session adds its items after the items of the earlier process", async () => {
    const folder = mkdtempSync(join(tmpdir(), "server-test-"))
    cleanups.unshift(async () => rmSync(folder, { recursive: true }))
    const file = join(folder, "agents.db")
    const first = await startServer("resume-1", file)
    await sendMessage(first.base, first.conversation.id, "Remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(first.base, first.conversation.id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })
    await first.stop()
    cleanups.splice(cleanups.indexOf(first.stop), 1)

    const second = await startServer("resume-1", file, first)
    await sendMessage(second.base, second.conversation.id, "What was it?")

    await vi.waitFor(async () => {
      const { items } = await timeline(second.base, second.conversation.id)
      expect(items.map(({ item }) => [item.kind, item.text])).toEqual([
        ["message", "Remember kiwi."],
        ["message", "ok"],
        ["turn", undefined],
        ["message", "What was it?"],
        ["message", "ok"],
        ["turn", undefined],
      ])
    })
  })

  test("the event stream sends each item change and each state change of the agent", async () => {
    const { base, conversation } = await startServer()
    const stream = openEvents(base, conversation.id)
    await stream.ready

    await sendMessage(base, conversation.id, "Remember kiwi.")

    await vi.waitFor(() =>
      expect(agentStates(stream.events)).toEqual([
        "starting",
        "idle",
        "busy",
        "idle",
      ])
    )
    expect(streamedItems(stream.events)).toEqual([
      ["message", "done", "Remember kiwi."],
      ["message", "streaming", "ok"],
      ["message", "done", "ok"],
      ["turn", "done", undefined],
    ])
  })

  test("a stream that connects again with Last-Event-ID gets each event that it did not get", async () => {
    const { base, conversation } = await startServer()
    const first = openEvents(base, conversation.id)
    await first.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(first.events)).toHaveLength(4))
    const lastSeen = first.events[2].id

    const again = openEvents(base, conversation.id, lastSeen)

    await vi.waitFor(() => expect(again.events).toEqual(first.events.slice(3)))
  })

  test("the timeline gives the id of the last event, so a stream from it misses nothing", async () => {
    const { base, conversation } = await startServer()
    const watcher = openEvents(base, conversation.id)
    await watcher.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(watcher.events)).toHaveLength(4))

    const { lastEventId } = await timeline(base, conversation.id)

    expect(lastEventId).toBe(watcher.events.at(-1)?.id)
  })

  test("the user can allow once, deny, or always allow a tool, and each card shows the answer", async () => {
    const { base, sent, conversation } = await startServer("tools")
    await sendMessage(base, conversation.id, "Do these steps in order.")

    for (const decision of ["allow_once", "deny", "always_allow"]) {
      const requestId = await nextPendingCard(base, conversation.id)
      const response = await answerRequest(base, requestId, { decision })
      expect(response.status).toBe(202)
    }

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items
          .filter(({ item }) => item.kind === "permission")
          .map(({ item }) => [item.toolName, item.status])
      ).toEqual([
        ["Edit", "allowed"],
        ["Bash", "denied"],
        ["Write", "allowed"],
      ])
    })
    expect(
      sent
        .filter((line) => line.type === "control_response")
        .map((line) => (line.response as Record<string, unknown>).response)
    ).toEqual([
      {
        behavior: "allow",
        updatedInput: {
          file_path: "/private/tmp/claude-fixture/tools/notes.txt",
          old_string: "beta",
          new_string: "BETA",
          replace_all: false,
        },
      },
      { behavior: "deny", message: "The user denied this." },
      {
        behavior: "allow",
        updatedInput: {
          file_path: "/private/tmp/claude-fixture/tools/out.txt",
          content: "done",
        },
        updatedPermissions: [
          { type: "setMode", mode: "acceptEdits", destination: "session" },
        ],
      },
    ])
  })

  test("the user can answer a question, and the card keeps the answer", async () => {
    const { base, sent, conversation } = await startServer("question")
    await sendMessage(base, conversation.id, "Ask me which colour I prefer.")

    const requestId = await nextPendingCard(base, conversation.id)
    await answerRequest(base, requestId, {
      answers: { "Which colour do you prefer?": "Red" },
    })

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items.find(({ item }) => item.kind === "question")?.item
      ).toMatchObject({
        status: "answered",
        answers: { "Which colour do you prefer?": "Red" },
      })
    })
    expect(
      sent
        .filter((line) => line.type === "control_response")
        .map((line) => (line.response as Record<string, unknown>).response)
    ).toEqual([
      {
        behavior: "allow",
        updatedInput: {
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
          answers: { "Which colour do you prefer?": "Red" },
        },
      },
    ])
  })

  test("stop interrupts the busy agent and removes the prompts in its queue", async () => {
    const { base, sent, conversation } = await startServer("interrupt")
    const stream = openEvents(base, conversation.id)
    await stream.ready
    await sendMessage(base, conversation.id, "Write a long story.")
    await vi.waitFor(() => expect(agentStates(stream.events)).toContain("busy"))
    await sendMessage(base, conversation.id, "Then write a poem.")

    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/stop`,
      { method: "POST" }
    )

    expect(response.status).toBe(202)
    await vi.waitFor(() =>
      expect(agentStates(stream.events).at(-1)).toBe("idle")
    )
    expect(streamedItems(stream.events).at(-1)).toEqual([
      "turn",
      "stopped",
      undefined,
    ])
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(sent.filter((line) => line.type === "user")).toHaveLength(1)
  })

  test("the server listens only on the local address", async () => {
    const { address } = await startServer()

    expect(address.host).toBe("127.0.0.1")
  })

  test("a message to a conversation that does not exist gives not found", async () => {
    const { base } = await startServer()

    const response = await sendMessage(base, "no-such-conversation", "Hello?")

    expect(response.status).toBe(404)
  })

  test("an agent can be created and then shows in the list of agents", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/agents", testRunner)
    const created = (await response.json()) as { agent: { id: string } }

    expect(response.status).toBe(201)
    const listed = (await (await fetch(`${base}/api/agents`)).json()) as {
      agents: unknown[]
    }
    expect(listed.agents).toContainEqual(
      expect.objectContaining({ id: created.agent.id, ...testRunner })
    )
  })

  test("an agent with no name, folder or model is refused", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/agents", {
      ...testRunner,
      name: "",
      cwd: "",
      model: "",
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "These fields are empty: name, cwd, model.",
    })
  })

  test("a change to an agent keeps the fields that it does not name", async () => {
    const { base } = await startServer()
    const created = (await (
      await postJson(base, "/api/agents", testRunner)
    ).json()) as { agent: { id: string } }

    const response = await fetch(`${base}/api/agents/${created.agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        allowedTools: ["Read"],
      }),
    })

    expect(response.status).toBe(200)
    const listed = (await (await fetch(`${base}/api/agents`)).json()) as {
      agents: { id: string }[]
    }
    expect(
      listed.agents.find((agent) => agent.id === created.agent.id)
    ).toMatchObject({
      ...testRunner,
      model: "claude-haiku-5-5",
      allowedTools: ["Read"],
    })
  })

  test("a DM with an agent opens once, and the list of conversations shows it", async () => {
    const { base } = await startServer()
    const created = (await (
      await postJson(base, "/api/agents", testRunner)
    ).json()) as { agent: { id: string } }

    const first = await postJson(base, "/api/conversations", {
      kind: "dm",
      agentId: created.agent.id,
    })
    const again = await postJson(base, "/api/conversations", {
      kind: "dm",
      agentId: created.agent.id,
    })

    const opened = (await first.json()) as { conversation: { id: string } }
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ conversation: opened.conversation })
    const listed = (await (
      await fetch(`${base}/api/conversations`)
    ).json()) as {
      conversations: unknown[]
    }
    expect(listed.conversations).toContainEqual(
      expect.objectContaining({
        id: opened.conversation.id,
        kind: "dm",
        name: "test-runner",
        members: ["user:me", `agent:${created.agent.id}`],
      })
    )
  })

  test("a conversation gives its agents and the state of each agent", async () => {
    const { base, agent, conversation } = await startServer()
    const stream = openEvents(base, conversation.id)
    await stream.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(stream.events)).toHaveLength(4))

    const response = await fetch(`${base}/api/conversations/${conversation.id}`)

    expect(await response.json()).toEqual({
      conversation,
      agents: [{ ...agent, state: "idle" }],
    })
  })

  test("a first stream with lastEventId in its address gets each event after that id", async () => {
    const { base, conversation } = await startServer()
    const watcher = openEvents(base, conversation.id)
    await watcher.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(watcher.events)).toHaveLength(4))

    const fromQuery = openEvents(base, conversation.id, 5, "query")

    await vi.waitFor(() =>
      expect(fromQuery.events).toEqual(
        watcher.events.filter((event) => event.id > 5)
      )
    )
  })

  test("a stream with no event id gets only the events that come after it opens", async () => {
    const { base, conversation } = await startServer()
    const watcher = openEvents(base, conversation.id)
    await watcher.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(watcher.events)).toHaveLength(4))

    const late = openEvents(base, conversation.id)
    await late.ready
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(late.events).toEqual([])
  })

  test("an agent can be read by its id, and an unknown id gives not found", async () => {
    const { base } = await startServer()
    const created = (await (
      await postJson(base, "/api/agents", testRunner)
    ).json()) as { agent: { id: string } }

    const found = await fetch(`${base}/api/agents/${created.agent.id}`)
    const missing = await fetch(`${base}/api/agents/no-such-agent`)

    expect(await found.json()).toEqual({ agent: created.agent })
    expect(missing.status).toBe(404)
  })
})
