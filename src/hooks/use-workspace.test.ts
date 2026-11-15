import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { useWorkspace } from "@/hooks/use-workspace"
import {
  directMessage,
  releaseChannel,
  reviewerBot,
  squadGroup,
  testRunner,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, directMessage],
    unread: { [releaseChannel.id]: 2 },
  })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
})

describe("useWorkspace", () => {
  test("loads the conversations and the agents, then follows the state of each agent", async () => {
    const { result } = renderHook(() => useWorkspace())
    await waitFor(() =>
      expect(result.current.agents).toEqual([reviewerBot, testRunner])
    )
    expect(result.current.conversations).toEqual([
      releaseChannel,
      directMessage,
    ])

    act(() =>
      network
        .stream("/api/events")
        .emit(1, { type: "agent_state", agentId: "a1", state: "busy" })
    )

    expect(result.current.agents).toEqual([
      reviewerBot,
      { ...testRunner, state: "busy" },
    ])
  })

  test("a new conversation on the stream joins the list", async () => {
    const { result } = renderHook(() => useWorkspace())
    await waitFor(() => expect(result.current.agents).toHaveLength(2))

    act(() =>
      network
        .stream("/api/events")
        .emit(1, { type: "conversation", conversation: squadGroup })
    )

    expect(result.current.conversations).toEqual([
      releaseChannel,
      directMessage,
      squadGroup,
    ])
  })

  test("a reset loads the lists again and opens a new stream", async () => {
    const { result } = renderHook(() => useWorkspace())
    await waitFor(() => expect(result.current.agents).toHaveLength(2))
    const first = network.stream("/api/events")
    network.on("GET", "/api/agents", { agents: [testRunner] })

    act(() => first.emit(0, { type: "reset" }))

    await waitFor(() => expect(result.current.agents).toEqual([testRunner]))
    expect(first.closed).toBe(true)
    expect(network.stream("/api/events")).not.toBe(first)
  })

  test("the unread count of each conversation follows the stream, and the count 0 clears it", async () => {
    const { result } = renderHook(() => useWorkspace())
    await waitFor(() =>
      expect(result.current.unread).toEqual({ [releaseChannel.id]: 2 })
    )
    const stream = network.stream("/api/events")

    act(() =>
      stream.emit(1, {
        type: "unread",
        conversationId: directMessage.id,
        count: 1,
      })
    )
    act(() =>
      stream.emit(2, {
        type: "unread",
        conversationId: releaseChannel.id,
        count: 0,
      })
    )

    expect(result.current.unread).toEqual({ [directMessage.id]: 1 })
  })
})
