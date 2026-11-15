import { mkdtempSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  agentStates,
  answerRequest,
  cleanups,
  nextPendingCard,
  openAppEvents,
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

  test("the session of an agent gives the data of the session card", async () => {
    const { base, agent, conversation } = await startServer()
    await fetch(`${base}/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: join(homedir(), "code", "web-app") }),
    })
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })

    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/agents/${agent.id}/session`
    )

    expect(await response.json()).toEqual({
      session: {
        claudeSessionId: "7e27a04a-8178-4a22-aad9-d886c125c430",
        state: "idle",
        model: "claude-haiku-5-5",
        permissionMode: "default",
        directory: "~/code/web-app",
        allowedTools: [],
        turns: 1,
        costUsd: 0.00553128,
        configChanged: false,
      },
    })
  })

  test("before the first process, the session card shows the configuration of the agent", async () => {
    const { base, agent, conversation } = await startServer()
    await fetch(`${base}/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cwd: join(homedir(), "code", "web-app"),
        allowedTools: ["Read"],
      }),
    })

    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/agents/${agent.id}/session`
    )

    expect(await response.json()).toEqual({
      session: {
        claudeSessionId: null,
        state: "exited",
        model: "claude-haiku-5-5",
        permissionMode: "default",
        directory: "~/code/web-app",
        allowedTools: ["Read"],
        turns: 0,
        costUsd: 0,
        configChanged: false,
      },
    })
  })

  test("after a change to the agent, the session shows the configuration that runs, and that it changed", async () => {
    const { base, agent, conversation } = await startServer()
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })

    await fetch(`${base}/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5" }),
    })
    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/agents/${agent.id}/session`
    )

    expect(await response.json()).toMatchObject({
      session: { model: "claude-haiku-5-5", configChanged: true },
    })
  })

  test("new session stops the process, adds a divider, and starts a process with a new Claude session id", async () => {
    const { base, started, agent, conversation } = await startServer()
    const stream = openEvents(base, conversation.id)
    await stream.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(stream.events)).toHaveLength(4))

    const response = await postJson(
      base,
      `/api/conversations/${conversation.id}/agents/${agent.id}/sessions`,
      {}
    )

    expect(response.status).toBe(201)
    const { session } = (await response.json()) as {
      session: { claudeSessionId: string; turns: number }
    }
    expect(session.claudeSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(session.claudeSessionId).not.toBe(
      "7e27a04a-8178-4a22-aad9-d886c125c430"
    )
    expect(session.turns).toBe(0)
    await vi.waitFor(() =>
      expect(agentStates(stream.events)).toEqual([
        "starting",
        "idle",
        "busy",
        "idle",
        "exited",
        "starting",
        "idle",
      ])
    )
    expect(started).toHaveLength(2)
    expect(started[1].slice(-2)).toEqual([
      "--session-id",
      session.claudeSessionId,
    ])
    expect(started[1]).not.toContain("--resume")
    const { items } = await timeline(base, conversation.id)
    expect(items.at(-1)).toMatchObject({
      authorKey: `agent:${agent.id}`,
      item: { kind: "session_start", claudeSessionId: session.claudeSessionId },
    })
  })

  test("autostart starts the DM process of each autostart agent, with no prompt", async () => {
    const { store, server, startedAgents, sentTo } = await startServer()
    const runner = store.createAgent({
      name: "test-runner",
      colour: "aqua",
      model: "claude-haiku-5-5",
      permissionMode: "default",
      cwd: process.cwd(),
      autostart: true,
      allowedTools: [],
      disallowedTools: [],
      systemPrompt: null,
      description: null,
      maxTurns: null,
    })
    store.createConversation({
      kind: "dm",
      name: "test-runner",
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${runner.id}`],
    })
    store.createAgent({ ...runner, name: "docs-writer" })

    server.autostart()

    expect(startedAgents).toEqual(["test-runner"])
    await vi.waitFor(() =>
      expect(
        (sentTo.get("test-runner") ?? []).map((line) => line.type)
      ).toEqual(["control_request"])
    )
  })

  test("a new Claude session that had no turn before a server start starts again with its id, not with resume", async () => {
    const { base, store, started, agent, conversation } = await startServer()
    const earlier = store.createSession({
      agentId: agent.id,
      conversationId: conversation.id,
      claudeSessionId: "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
      claudeSessionNew: true,
    })
    store.updateSession(earlier.id, { state: "exited" })

    await sendMessage(base, conversation.id, "Hello.")

    expect(started[0].slice(-2)).toEqual([
      "--session-id",
      "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
    ])
  })

  test("the session log of an agent gives the lines of its processes, the last page first", async () => {
    const { base, agent, conversation } = await startServer()
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })
    const route = `${base}/api/conversations/${conversation.id}/agents/${agent.id}/log`

    const all = (await (await fetch(route)).json()) as {
      lines: { seq: number; direction: string; text: string }[]
    }
    const before = all.lines[2].seq
    const page = (await (await fetch(`${route}?before=${before}`)).json()) as {
      lines: { seq: number }[]
    }

    expect(all.lines.slice(0, 2).map((line) => line.direction)).toEqual([
      "in",
      "out",
    ])
    expect(JSON.parse(all.lines[0].text)).toMatchObject({
      type: "control_request",
      request: { subtype: "initialize" },
    })
    expect(
      all.lines.filter((line) => line.text.includes('"type":"result"'))
    ).toHaveLength(1)
    expect(page.lines.map((line) => line.seq)).toEqual([
      all.lines[0].seq,
      all.lines[1].seq,
    ])
  })

  test("each line of a process goes live to the open streams, with no id, and is not replayed", async () => {
    const { base, agent, conversation } = await startServer()
    const live = openEvents(base, conversation.id)
    await live.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(live.events)).toHaveLength(4))

    const { lines } = live
    const replay = openEvents(base, conversation.id, 0)

    expect(lines.length).toBeGreaterThan(5)
    expect(lines[0]).toMatchObject({
      id: Number.NaN,
      data: { agentId: agent.id, line: { direction: "in" } },
    })
    await vi.waitFor(() => expect(agentStates(replay.events)).toHaveLength(4))
    expect(replay.lines).toEqual([])
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

  test("the app stream sends each change of the state of an agent", async () => {
    const { base, agent, conversation } = await startServer()
    const stream = openAppEvents(base)
    await stream.ready

    await sendMessage(base, conversation.id, "Remember kiwi.")

    await vi.waitFor(() =>
      expect(
        stream.events
          .map(({ data }) => data)
          .filter((data) => data.type === "agent_state")
      ).toEqual([
        { type: "agent_state", agentId: agent.id, state: "starting" },
        { type: "agent_state", agentId: agent.id, state: "idle" },
        { type: "agent_state", agentId: agent.id, state: "busy" },
        { type: "agent_state", agentId: agent.id, state: "idle" },
      ])
    )
  })

  test("the app stream sends each new conversation", async () => {
    const { base, agent } = await startServer()
    const stream = openAppEvents(base)
    await stream.ready

    const response = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: "release-train",
      agentIds: [agent.id],
    })
    const { conversation } = (await response.json()) as {
      conversation: { id: string }
    }

    await vi.waitFor(() =>
      expect(stream.events.map(({ data }) => data)).toEqual([
        { type: "conversation", conversation },
      ])
    )
  })

  test("a stream asks for events that the cut log no longer holds, and gets a reset", async () => {
    const { base, conversation } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({}),
      { eventLogSize: 3 }
    )
    const first = openEvents(base, conversation.id)
    await first.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(first.events)).toHaveLength(4))
    const last = first.events.at(-1)?.id ?? 0

    const late = openEvents(base, conversation.id, 1)
    const recent = openEvents(base, conversation.id, last - 2)
    const ahead = openEvents(base, conversation.id, last + 5)

    await vi.waitFor(() => {
      expect(late.events.map(({ data }) => data)).toEqual([{ type: "reset" }])
      expect(recent.events).toEqual(first.events.slice(-2))
      expect(ahead.events.map(({ data }) => data)).toEqual([{ type: "reset" }])
    })
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

  test("an agent with no name or model is refused", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/agents", {
      ...testRunner,
      name: "  ",
      model: "",
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Give the agent a name. Pick a model.",
      fields: {
        name: "Give the agent a name.",
        model: "Pick a model.",
      },
    })
  })

  test("a generic agent with no folder can be created", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/agents", {
      ...testRunner,
      cwd: "  ",
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ agent: { cwd: null } })
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

  test("an agent keeps its description, and an empty description is stored as null", async () => {
    const { base } = await startServer()
    const created = (await (
      await postJson(base, "/api/agents", {
        ...testRunner,
        description: "Runs and fixes the Vitest tests.",
      })
    ).json()) as { agent: { id: string; description: string | null } }

    const response = await fetch(`${base}/api/agents/${created.agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "" }),
    })

    expect(created.agent.description).toBe("Runs and fixes the Vitest tests.")
    expect(await response.json()).toMatchObject({
      agent: { description: null },
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
      agents: [{ ...agent, state: "idle", sessionCwd: agent.cwd }],
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
