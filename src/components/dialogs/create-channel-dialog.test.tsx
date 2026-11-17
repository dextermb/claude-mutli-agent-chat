import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"

import { App } from "@/App"
import {
  directMessage,
  releaseChannel,
  reviewerBot,
  testRunner,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations", { conversations: [directMessage] })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
  for (const conversation of [releaseChannel, directMessage]) {
    network.on("GET", `/api/conversations/${conversation.id}`, {
      conversation,
      agents: [testRunner],
    })
    network.on("GET", `/api/conversations/${conversation.id}/timeline`, {
      items: [],
      lastEventId: 0,
    })
  }
  window.history.pushState({}, "", "/conversations/c1")
})

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(
    await screen.findByRole("button", { name: "Create a channel" })
  )
  return screen.getByRole("dialog", { name: "Create a channel" })
}

describe("the Create a channel dialog", () => {
  test("each field of the new channel reaches the request, and the page moves to the channel", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations",
      { conversation: releaseChannel },
      201
    )
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText("Name"), "release-train")
    await user.type(
      within(dialog).getByLabelText("Topic"),
      "Ship v2.4 on Friday."
    )
    await user.click(
      within(dialog).getByRole("switch", { name: "Private channel" })
    )
    await user.type(
      within(dialog).getByLabelText("Working directory"),
      "/home/user/code/release"
    )
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Invite test-runner" })
    )
    await user.click(
      within(dialog).getByRole("radio", { name: /Every message/ })
    )
    await user.type(
      within(dialog).getByRole("textbox", { name: "Rules" }),
      "Write findings only."
    )
    expect(
      within(dialog).getByLabelText("Working directory")
    ).toHaveAccessibleDescription(
      "Each agent in this channel works in this folder. Empty: each agent works in its own folder."
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Create channel" })
    )

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations",
          body: {
            kind: "channel",
            name: "release-train",
            topic: "Ship v2.4 on Friday.",
            private: true,
            replyMode: "every",
            cwd: "/home/user/code/release",
            rules: "Write findings only.",
            agentIds: ["a1"],
          },
        },
      ]
    )
    await waitFor(() =>
      expect(window.location.pathname).toBe("/conversations/ch1")
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("a channel name with capitals shows the rule after the field, and sends nothing", async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    const name = within(dialog).getByLabelText("Name")

    await user.type(name, "Release Train")
    await user.tab()

    expect(
      await within(dialog).findByText(
        "Use only lowercase letters, numbers and hyphens in a channel name."
      )
    ).toBeInTheDocument()
    expect(name).toHaveAttribute("aria-invalid", "true")
    await user.click(
      within(dialog).getByRole("button", { name: "Create channel" })
    )
    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      []
    )
  })

  test("the dialog shows why the server refused the channel, and stays open", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations",
      { error: "A channel with the name release-train exists." },
      409
    )
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText("Name"), "release-train")
    await user.click(
      within(dialog).getByRole("button", { name: "Create channel" })
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A channel with the name release-train exists."
    )
    expect(window.location.pathname).toBe("/conversations/c1")
  })

  test("the dialog says that the server did not answer when no answer comes", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations")
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText("Name"), "release-train")
    await user.click(
      within(dialog).getByRole("button", { name: "Create channel" })
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The server did not answer."
    )
  })
})
