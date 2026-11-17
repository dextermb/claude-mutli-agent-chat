import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"

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
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
    unread: {},
  })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
  window.history.pushState({}, "", "/")
})

describe("delete from the sidebar", () => {
  test("the user can delete a channel from its row, after a confirm", async () => {
    const user = userEvent.setup()
    network.on("DELETE", "/api/conversations/ch1", null, 204)
    render(<App />)

    await user.click(
      await screen.findByRole("button", {
        name: "Delete channel #release-train",
      })
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete #release-train?",
    })
    expect(network.sent.map(({ method }) => method)).not.toContain("DELETE")
    await user.click(
      within(dialog).getByRole("button", { name: "Delete channel" })
    )

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
    expect(network.sent).toContainEqual({
      method: "DELETE",
      url: "/api/conversations/ch1",
      body: undefined,
    })
  })

  test("the user can delete an agent from its row, the confirm says what goes, and the page leaves its open DM", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/conversations/c1", {
      conversation: directMessage,
      agents: [testRunner],
    })
    network.on("GET", "/api/conversations/c1/timeline", {
      items: [],
      lastEventId: 0,
    })
    network.on("DELETE", "/api/agents/a1", null, 204)
    window.history.pushState({}, "", "/conversations/c1")
    render(<App />)

    await user.click(
      await screen.findByRole("button", { name: "Delete agent test-runner" })
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete test-runner?",
    })
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      'test-runner leaves #release-train and reviewer-bot, test-runner. Its messages there stay, with the label "Deleted agent".',
      "The DM with test-runner and its sessions are deleted.",
      "The files in /home/user/code/web-app stay.",
    ])
    await user.click(
      within(dialog).getByRole("button", { name: "Delete agent" })
    )

    await waitFor(() => expect(window.location.pathname).toBe("/"))
    expect(network.sent).toContainEqual({
      method: "DELETE",
      url: "/api/agents/a1",
      body: undefined,
    })
  })

  test("a toast says when an agent is deleted", async () => {
    const user = userEvent.setup()
    network.on("DELETE", "/api/agents/a1", null, 204)
    render(<App />)

    await user.click(
      await screen.findByRole("button", { name: "Delete agent test-runner" })
    )
    await user.click(
      within(
        screen.getByRole("alertdialog", { name: "Delete test-runner?" })
      ).getByRole("button", { name: "Delete agent" })
    )

    expect(
      await screen.findByRole("dialog", { name: "test-runner is deleted." })
    ).toBeInTheDocument()
  })

  test("a refused delete shows the reason, and the dialog stays open", async () => {
    const user = userEvent.setup()
    network.on(
      "DELETE",
      "/api/conversations/ch1",
      { error: "The channel is busy." },
      409
    )
    render(<App />)

    await user.click(
      await screen.findByRole("button", {
        name: "Delete channel #release-train",
      })
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete #release-train?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Delete channel" })
    )

    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("Delete channel did not work.")
    expect(alert).toHaveTextContent("The channel is busy.")
    expect(
      within(dialog).getByRole("button", { name: "Delete channel" })
    ).toBeEnabled()
  })

  test("each × names the kind and the name of its row, so a group chat and an agent with one name differ", async () => {
    network.on("GET", "/api/conversations", {
      conversations: [
        releaseChannel,
        {
          ...squadGroup,
          name: "test-runner",
          members: ["user:me", "agent:a1"],
        },
        directMessage,
      ],
      unread: {},
    })
    render(<App />)
    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })
    await within(sidebar).findByRole("button", {
      name: "Delete channel #release-train",
    })

    expect(
      within(sidebar)
        .getAllByRole("button", { name: /^Delete / })
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual([
      "Delete channel #release-train",
      "Delete group chat test-runner",
      "Delete agent reviewer-bot",
      "Delete agent test-runner",
    ])
  })
})

describe("the names of agents in the sidebar", () => {
  test("an agent with a display name shows it in its row and in its delete confirm", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents", {
      agents: [reviewerBot, { ...testRunner, displayName: "Test Runner" }],
    })
    render(<App />)

    const nav = within(
      await screen.findByRole("navigation", { name: "Conversations" })
    )
    expect(await nav.findByText("Test Runner")).toBeInTheDocument()
    expect(nav.queryByText("test-runner")).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Delete agent Test Runner" })
    )
    expect(
      screen.getByRole("alertdialog", { name: "Delete Test Runner?" })
    ).toBeInTheDocument()
  })
})

describe("hiding the sidebar", () => {
  test("the user can hide the conversations and show them again", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })

    await user.click(screen.getByRole("button", { name: "Hide the sidebar" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole("button", { name: "Show the sidebar" }))

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
  })

  test("Cmd-B hides the conversations, and shows them again", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })

    await user.keyboard("{Meta>}b{/Meta}")

    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )

    await user.keyboard("{Meta>}b{/Meta}")

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
  })

  test("the app opens with the sidebar that the last visit left", async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })
    await user.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
    first.unmount()

    render(<App />)

    expect(
      await screen.findByRole("button", { name: "Show the sidebar" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Conversations" })
    ).not.toBeInTheDocument()
  })

  test("the hidden sidebar leaves the unread count and the work on the rail", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/conversations", {
      conversations: [releaseChannel, squadGroup, directMessage],
      unread: { ch1: 2, c1: 1 },
    })
    network.on("GET", "/api/agents", {
      agents: [reviewerBot, { ...testRunner, state: "busy" }],
    })
    render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })

    await user.click(screen.getByRole("button", { name: "Hide the sidebar" }))

    const rail = within(
      await screen.findByRole("navigation", { name: "Workspace" })
    )
    expect(
      rail.getByRole("button", { name: "Show the sidebar, 3 unread" })
    ).toBeInTheDocument()
    expect(
      rail.getByRole("link", { name: "Agents, 1 agent working" })
    ).toBeInTheDocument()
  })

  test("the pointer on the rail floats the conversations, and leaving the rail hides them", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })
    await user.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
    const rail = screen.getByRole("navigation", { name: "Workspace" })
    await user.hover(screen.getByRole("heading", { name: "Agents", level: 1 }))

    await user.hover(rail)

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()

    await user.unhover(rail)

    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
  })

  test("the floating conversations stay while the keyboard is in them", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("navigation", { name: "Conversations" })
    await user.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
    const rail = screen.getByRole("navigation", { name: "Workspace" })
    await user.hover(screen.getByRole("heading", { name: "Agents", level: 1 }))
    await user.hover(rail)
    const list = await screen.findByRole("navigation", {
      name: "Conversations",
    })
    for (let tabs = 0; tabs < 16; tabs++) {
      if (list.contains(document.activeElement)) break
      await user.tab()
    }
    expect(list.contains(document.activeElement)).toBe(true)

    await user.unhover(rail)
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(
      screen.getByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
  })
})
