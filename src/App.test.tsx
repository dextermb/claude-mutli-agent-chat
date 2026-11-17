import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { App } from "@/App"
import {
  directMessage,
  releaseChannel,
  reviewerBot,
  squadGroup,
  testRunner,
} from "@/test/conversation-data"
import { FakeEventSource, fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

function renderAt(url: string) {
  window.history.pushState({}, "", url)
  return render(<App />)
}

function openAppStreams() {
  return FakeEventSource.opened.filter(
    (source) => source.url === "/api/events" && !source.closed
  )
}

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
    unread: {},
  })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
})

describe("routing", () => {
  it("shows a not-found page for an unknown URL", async () => {
    renderAt("/no-such-page")
    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
  })
})

describe("the app stream", () => {
  it.each(["/", "/agents/new"])(
    "the page %s opens one app stream",
    async (url) => {
      renderAt(url)
      const sidebar = await screen.findByRole("navigation", {
        name: "Conversations",
      })
      await within(sidebar).findByRole("link", { name: /release-train/ })

      expect(openAppStreams()).toHaveLength(1)
    }
  )

  it("keeps a change from the stream after a move to another page", async () => {
    const user = userEvent.setup()
    const lintFixer = { ...testRunner, id: "a3", name: "lint-fixer" }
    renderAt("/")
    await within(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).findByRole("link", { name: /release-train/ })
    act(() =>
      network
        .stream("/api/events")
        .emit(1, { type: "agent", agent: { ...lintFixer, state: "exited" } })
    )

    await user.click(screen.getByRole("link", { name: "New agent" }))

    expect(
      await screen.findByRole("button", { name: "Create agent" })
    ).toBeInTheDocument()
    const sidebar = screen.getByRole("navigation", { name: "Conversations" })
    expect(
      within(sidebar).getByRole("button", { name: /^lint-fixer/ })
    ).toBeInTheDocument()
    expect(openAppStreams()).toHaveLength(1)
  })
})
