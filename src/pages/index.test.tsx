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
import { screenWidth } from "@/test/fake-screen"

let network: ReturnType<typeof fakeNetwork>

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
    unread: {},
  })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
})

describe("the home page on a narrow screen", () => {
  test("the sidebar opens from a button in the header", async () => {
    const user = userEvent.setup()
    screenWidth(375)
    window.history.pushState({}, "", "/")
    render(<App />)
    const header = within(await screen.findByRole("banner"))
    expect(
      screen.queryByRole("navigation", { name: "Conversations" })
    ).not.toBeInTheDocument()

    await user.click(header.getByRole("button", { name: "Open the sidebar" }))

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
  })
})

describe("the workspace rail", () => {
  test("the rail goes home and to the agents, and holds no other page", async () => {
    window.history.pushState({}, "", "/")
    render(<App />)
    const rail = within(
      await screen.findByRole("navigation", { name: "Workspace" })
    )

    expect(rail.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(rail.getByRole("link", { name: "Agents" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(rail.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("the sidebar", () => {
  test("the + of Group chats opens Start a chat", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/")
    render(<App />)
    const sidebar = within(
      await screen.findByRole("navigation", { name: "Conversations" })
    )

    await user.click(
      sidebar.getByRole("button", { name: "Start a group chat" })
    )

    expect(
      await screen.findByRole("dialog", { name: "Start a chat" })
    ).toBeInTheDocument()
  })
})

describe("the agents page", () => {
  const migrator = {
    ...testRunner,
    id: "a3",
    name: "migrator",
    colour: "blue",
    state: "failed" as const,
  }

  test("each agent shows its status, and a line counts the agents by status", async () => {
    network.on("GET", "/api/agents", {
      agents: [reviewerBot, { ...testRunner, state: "busy" }, migrator],
    })
    window.history.pushState({}, "", "/")
    render(<App />)
    const list = within(await screen.findByRole("list", { name: "Agents" }))

    await waitFor(() => expect(list.getAllByRole("listitem")).toHaveLength(3))
    const runner = within(list.getByRole("listitem", { name: "test-runner" }))
    expect(runner.getByText("Working")).toBeInTheDocument()
    expect(
      screen.getByText("3 agents · 1 working · 1 error")
    ).toBeInTheDocument()
  })

  test("an agent shows its model and its folder, and a generic agent says that it has no folder", async () => {
    network.on("GET", "/api/agents", {
      agents: [reviewerBot, { ...testRunner, cwd: null }],
    })
    window.history.pushState({}, "", "/")
    render(<App />)
    const list = within(await screen.findByRole("list", { name: "Agents" }))

    await waitFor(() => expect(list.getAllByRole("listitem")).toHaveLength(2))
    expect(
      within(list.getByRole("listitem", { name: "reviewer-bot" })).getByText(
        "claude-sonnet-5-5 · /home/user/code/web-app"
      )
    ).toBeInTheDocument()
    expect(
      within(list.getByRole("listitem", { name: "test-runner" })).getByText(
        "claude-sonnet-5-5 · No folder"
      )
    ).toBeInTheDocument()
  })

  test("the user can search the agents by name", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/")
    render(<App />)
    const list = within(await screen.findByRole("list", { name: "Agents" }))
    await waitFor(() => expect(list.getAllByRole("listitem")).toHaveLength(2))

    await user.type(
      screen.getByRole("textbox", { name: "Search agents" }),
      "REVIEW"
    )

    expect(list.getAllByRole("listitem")).toHaveLength(1)
    expect(
      list.getByRole("listitem", { name: "reviewer-bot" })
    ).toBeInTheDocument()
  })

  test("with no agents, the page says how to start", async () => {
    network.on("GET", "/api/agents", { agents: [] })
    window.history.pushState({}, "", "/")
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "There are no agents." })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Make an agent. Then message it in a DM, or invite it to a channel."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "Search agents" })
    ).not.toBeInTheDocument()
  })
})
