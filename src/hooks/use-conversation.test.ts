import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { useConversation } from "@/hooks/use-conversation"
import {
  agentMessage,
  directMessage,
  reviewerBot,
  testRunner,
  userMessage,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations/c1", {
    conversation: directMessage,
    agents: [testRunner],
  })
  network.on("GET", "/api/conversations/c1/timeline", {
    items: [userMessage, agentMessage],
    lastEventId: 7,
  })
})

describe("useConversation", () => {
  test("loads the conversation, its agents and the timeline", async () => {
    const { result } = renderHook(() => useConversation("c1"))

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.conversation).toEqual(directMessage)
    expect(result.current.agents).toEqual([testRunner])
    expect(result.current.entries).toEqual([userMessage, agentMessage])
  })

  test("a conversation event replaces the conversation and loads its agents again", async () => {
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    const changed = {
      ...directMessage,
      members: ["user:me", "agent:a1", "agent:a2"],
    }
    network.on("GET", "/api/conversations/c1", {
      conversation: changed,
      agents: [testRunner, reviewerBot],
    })

    act(() =>
      network
        .stream("/api/conversations/c1/events")
        .emit(1, { type: "conversation", conversation: changed })
    )

    expect(result.current.conversation).toEqual(changed)
    await waitFor(() =>
      expect(result.current.agents).toEqual([testRunner, reviewerBot])
    )
  })

  test("a line event of the session log does not change the timeline", async () => {
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))

    act(() =>
      network.stream("/api/conversations/c1/events").emit(0, {
        type: "line",
        agentId: "a1",
        line: {
          seq: 30,
          sessionId: "s1",
          direction: "out",
          at: "2026-11-15T14:05:00.000Z",
          text: '{"type":"system","subtype":"status"}',
        },
      })
    )

    expect(result.current.entries).toEqual([userMessage, agentMessage])
  })

  test("a reset event loads the timeline again and opens a new stream after its last event", async () => {
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    const first = network.stream()
    network.on("GET", "/api/conversations/c1/timeline", {
      items: [userMessage],
      lastEventId: 2,
    })

    act(() => first.emit(0, { type: "reset" }))

    await waitFor(() => expect(result.current.entries).toEqual([userMessage]))
    expect(first.closed).toBe(true)
    expect(network.stream().url).toBe(
      "/api/conversations/c1/events?lastEventId=2"
    )
  })

  test("opens the stream after the last event, and each item event changes or adds an entry", async () => {
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    const turn = {
      id: "s1/item-2",
      seq: 9,
      authorKey: "agent:a1",
      item: {
        kind: "turn",
        id: "item-2",
        status: "done",
        durationMs: 9161,
        costUsd: 0.0116,
        numTurns: 7,
      },
    }

    expect(network.stream().url).toBe(
      "/api/conversations/c1/events?lastEventId=7"
    )
    act(() => {
      network.stream().emit(8, {
        type: "item",
        entry: {
          ...agentMessage,
          item: { ...agentMessage.item, text: "I used a fixed clock." },
        },
      })
      network.stream().emit(9, { type: "item", entry: turn })
    })

    expect(result.current.entries).toEqual([
      userMessage,
      {
        ...agentMessage,
        item: { ...agentMessage.item, text: "I used a fixed clock." },
      },
      turn,
    ])
  })

  test("an agent state event changes the state of that agent", async () => {
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))

    act(() => {
      network
        .stream()
        .emit(8, { type: "agent_state", agentId: "a1", state: "waiting" })
    })

    expect(result.current.agents).toEqual([{ ...testRunner, state: "waiting" }])
  })

  test("sends a message, an answer to a request, and a stop to the server", async () => {
    network.on("POST", "/api/conversations/c1/messages", {}, 202)
    network.on("POST", "/api/requests/r1", {}, 202)
    network.on("POST", "/api/conversations/c1/stop", {}, 202)
    const { result } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))

    await act(async () => {
      await result.current.send("Run the tests.")
      await result.current.answer("r1", { decision: "allow_once" })
      await result.current.stop()
    })

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations/c1/messages",
          body: { text: "Run the tests." },
        },
        {
          method: "POST",
          url: "/api/requests/r1",
          body: { decision: "allow_once" },
        },
        { method: "POST", url: "/api/conversations/c1/stop", body: {} },
      ]
    )
  })

  test("closes the stream when the conversation is no longer shown", async () => {
    const { result, unmount } = renderHook(() => useConversation("c1"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    const source = network.stream()

    unmount()

    expect(source.closed).toBe(true)
  })
})
