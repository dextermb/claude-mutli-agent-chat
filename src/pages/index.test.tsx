import { render, screen, within } from "@testing-library/react"
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
    unread: [],
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
