import { afterEach, describe, expect, test, vi } from "vitest"
import {
  openAppEvents,
  postJson,
  runCleanups,
  sendMessage,
  startServer,
  timeline,
} from "../test/http.ts"

afterEach(runCleanups)

async function finishedTurn(base: string, conversationId: string) {
  await sendMessage(base, conversationId, "Remember kiwi.")
  await vi.waitFor(async () =>
    expect(
      (await timeline(base, conversationId)).items.map(({ item }) => item.kind)
    ).toContain("turn")
  )
}

async function listing(base: string) {
  const response = await fetch(`${base}/api/conversations`)
  return (await response.json()) as { unread: string[] }
}

describe("unread conversations", () => {
  test("the list of conversations names each conversation in which an agent wrote", async () => {
    const { base, conversation } = await startServer()
    expect((await listing(base)).unread).toEqual([])

    await finishedTurn(base, conversation.id)

    expect((await listing(base)).unread).toEqual([conversation.id])
  })

  test("a read of the last item clears the conversation, and the app stream says so", async () => {
    const { base, conversation } = await startServer()
    await finishedTurn(base, conversation.id)
    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/timeline`
    )
    const { items } = (await response.json()) as { items: { seq: number }[] }
    const stream = openAppEvents(base)
    await stream.ready

    const read = await postJson(
      base,
      `/api/conversations/${conversation.id}/read`,
      { seq: items.at(-1)?.seq }
    )

    expect(read.status).toBe(204)
    expect((await listing(base)).unread).toEqual([])
    await vi.waitFor(() =>
      expect(stream.events.map(({ data }) => data)).toEqual([
        { type: "unread", conversationId: conversation.id, unread: false },
      ])
    )
  })

  test("a read needs a conversation that exists and the place of an item", async () => {
    const { base, conversation } = await startServer()

    const unknown = await postJson(base, "/api/conversations/nope/read", {
      seq: 1,
    })
    const noPlace = await postJson(
      base,
      `/api/conversations/${conversation.id}/read`,
      { seq: "last" }
    )

    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: "no such conversation" })
    expect(noPlace.status).toBe(400)
    expect(await noPlace.json()).toEqual({
      error: "Give the seq of the last item that the user saw.",
    })
  })

  test("the first item of an agent sends one unread event, and the read sends one more", async () => {
    const { base, conversation } = await startServer()
    const stream = openAppEvents(base)
    await stream.ready

    await finishedTurn(base, conversation.id)
    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/timeline`
    )
    const { items } = (await response.json()) as { items: { seq: number }[] }
    await postJson(base, `/api/conversations/${conversation.id}/read`, {
      seq: items.at(-1)?.seq,
    })

    await vi.waitFor(() =>
      expect(
        stream.events
          .map(({ data }) => data)
          .filter((data) => data.type === "unread")
      ).toEqual([
        { type: "unread", conversationId: conversation.id, unread: true },
        { type: "unread", conversationId: conversation.id, unread: false },
      ])
    )
  })

  test("a process that fails makes its conversation unread, so the user sees the notice", async () => {
    const { base, conversation } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ mode: "crash" })
    )
    const stream = openAppEvents(base)
    await stream.ready

    await sendMessage(base, conversation.id, "Hello.")

    await vi.waitFor(() =>
      expect(
        stream.events
          .map(({ data }) => data)
          .filter((data) => data.type === "unread")
      ).toEqual([
        { type: "unread", conversationId: conversation.id, unread: true },
      ])
    )
    expect((await listing(base)).unread).toEqual([conversation.id])
  })
})
