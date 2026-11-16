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
      await screen.findByRole("button", { name: "Delete #release-train" })
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
      await screen.findByRole("button", { name: "Delete test-runner" })
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
      await screen.findByRole("button", { name: "Delete #release-train" })
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
})
