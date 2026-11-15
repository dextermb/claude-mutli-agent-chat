import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "@/App"
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
  network.on("GET", "/api/conversations", { conversations: [releaseChannel] })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
  for (const conversation of [releaseChannel, directMessage, squadGroup]) {
    network.on("GET", `/api/conversations/${conversation.id}`, {
      conversation,
      agents: [testRunner],
    })
    network.on("GET", `/api/conversations/${conversation.id}/timeline`, {
      items: [],
      lastEventId: 0,
    })
  }
  window.history.pushState({}, "", "/conversations/ch1")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole("button", { name: "Start a chat" }))
  return screen.getByRole("dialog", { name: "Start a chat" })
}

describe("the Start a chat dialog", () => {
  test("the user can find one agent, pick it, and open the DM with it", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/conversations", { conversation: directMessage })
    const dialog = await openDialog(user)
    expect(within(dialog).getByText("No agent picked")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Open DM" })
    ).toBeDisabled()

    await user.type(
      within(dialog).getByRole("textbox", { name: "Search agents" }),
      "test"
    )
    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => box.getAttribute("aria-label"))
    ).toEqual(["Pick test-runner"])
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick test-runner" })
    )
    expect(within(dialog).getByRole("list", { name: "To" })).toHaveTextContent(
      "test-runner"
    )
    expect(within(dialog).getByText("1 picked: a DM")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Open DM" }))

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations",
          body: { kind: "dm", agentId: "a1" },
        },
      ]
    )
    await waitFor(() =>
      expect(window.location.pathname).toBe("/conversations/c1")
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("the dialog shows the reason when the server refuses the chat, and stays open", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations",
      { error: "Give one or more agentIds." },
      400
    )
    const dialog = await openDialog(user)

    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick reviewer-bot" })
    )
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick test-runner" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Start group chat" })
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Give one or more agentIds."
    )
    expect(screen.getByRole("dialog", { name: "Start a chat" })).toBe(dialog)
    expect(window.location.pathname).toBe("/conversations/ch1")
  })

  test("two picked agents start a group chat, and the sidebar then lists it", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/conversations", { conversation: squadGroup }, 201)
    const dialog = await openDialog(user)

    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick reviewer-bot" })
    )
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick test-runner" })
    )
    expect(
      within(dialog).getByText("2 picked: a group chat")
    ).toBeInTheDocument()
    network.on("GET", "/api/conversations", {
      conversations: [releaseChannel, squadGroup],
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Start group chat" })
    )

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations",
          body: { kind: "group", agentIds: ["a2", "a1"] },
        },
      ]
    )
    await waitFor(() =>
      expect(window.location.pathname).toBe("/conversations/g1")
    )
    const sidebar = screen.getByRole("navigation", { name: "Conversations" })
    expect(
      await within(sidebar).findByRole("link", {
        name: "reviewer-bot, test-runner",
      })
    ).toHaveAttribute("aria-current", "page")
  })
})
