import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "@/App"
import type { TimelineEntry } from "@/lib/agent-api"
import {
  agentMessage,
  bashCall,
  colourQuestion,
  deniedCall,
  directMessage,
  editCall,
  finishedTurn,
  pushCall,
  pushRequest,
  readCall,
  stoppedTurn,
  testRunner,
  userMessage,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

function openConversation(entries: TimelineEntry[], state = testRunner.state) {
  network.on("GET", "/api/conversations/c1", {
    conversation: directMessage,
    agents: [{ ...testRunner, state }],
  })
  network.on("GET", "/api/conversations/c1/timeline", {
    items: entries,
    lastEventId: 0,
  })
  window.history.pushState({}, "", "/conversations/c1")
  return render(<App />)
}

beforeEach(() => {
  network = fakeNetwork()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the DM page", () => {
  test("shows the agent, its status, and the messages of the conversation", async () => {
    openConversation([userMessage, agentMessage])

    expect(
      await screen.findByRole("heading", { name: "test-runner" })
    ).toBeInTheDocument()
    expect(screen.getByText("Online")).toBeInTheDocument()
    const messages = screen.getAllByRole("article")
    expect(within(messages[0]).getByText("You")).toBeInTheDocument()
    expect(
      within(messages[0]).getByText("Fix the flaky auth test.")
    ).toBeInTheDocument()
    expect(within(messages[1]).getByText("test-runner")).toBeInTheDocument()
    expect(
      within(messages[1]).getByText("I will use a fixed clock.")
    ).toBeInTheDocument()
  })

  test("shows a message while it arrives, and marks it busy until it is complete", async () => {
    openConversation([userMessage])
    await screen.findByText("Fix the flaky auth test.")
    const piece = {
      ...agentMessage,
      item: { ...agentMessage.item, text: "I will use", status: "streaming" },
    } as TimelineEntry

    act(() => network.stream().emit(1, { type: "item", entry: piece }))

    expect(screen.getByText("I will use")).toHaveAttribute("aria-busy", "true")
    act(() => network.stream().emit(2, { type: "item", entry: agentMessage }))
    expect(screen.getByText("I will use a fixed clock.")).toHaveAttribute(
      "aria-busy",
      "false"
    )
  })

  test("shows each tool call with its main input and its result", async () => {
    openConversation([userMessage, readCall, editCall, bashCall, deniedCall])

    const read = await screen.findByRole("region", {
      name: "Read src/notes.txt",
    })
    expect(within(read).getByText("4 lines")).toBeInTheDocument()
    const edit = screen.getByRole("region", { name: "Edit src/notes.txt" })
    expect(within(edit).getByText("+1")).toBeInTheDocument()
    expect(within(edit).getByText("−1")).toBeInTheDocument()
    const bash = screen.getByRole("region", { name: "Bash echo hello" })
    expect(within(bash).getByText("hello")).toBeInTheDocument()
    const denied = screen.getByRole("region", {
      name: "Bash rm src/notes.txt",
    })
    expect(
      within(denied).getByText("The user denied this.")
    ).toBeInTheDocument()
  })

  test("the user can allow a tool once, and the card then shows that it is allowed", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/requests/r1", {}, 202)
    openConversation([userMessage, pushCall, pushRequest], "waiting")
    const card = await screen.findByRole("region", {
      name: "Approval for Bash git push origin release-train",
    })
    expect(
      screen.getByText("test-runner waits for your answer.")
    ).toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: "Allow once" }))

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/requests/r1",
      body: { decision: "allow_once" },
    })
    act(() =>
      network.stream().emit(1, {
        type: "item",
        entry: {
          ...pushRequest,
          item: { ...pushRequest.item, status: "allowed" },
        },
      })
    )
    expect(within(card).getByText("Allowed")).toBeInTheDocument()
    expect(within(card).queryByRole("button")).not.toBeInTheDocument()
  })

  test("always allow says what it grants, and sends the answer", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/requests/r1", {}, 202)
    openConversation([userMessage, pushCall, pushRequest], "waiting")
    const card = await screen.findByRole("region", {
      name: "Approval for Bash git push origin release-train",
    })
    const always = within(card).getByRole("button", { name: "Always allow" })

    expect(always).toHaveAccessibleDescription(
      "Lets test-runner run Bash(git push:*) with no request. The rule stays in the folder of the agent."
    )
    await user.click(always)
    expect(network.sent.at(-1)?.body).toEqual({ decision: "always_allow" })
  })

  test("always allow for an edit says that the agent can edit files until the session ends", async () => {
    const editRequest = {
      ...pushRequest,
      item: {
        ...pushRequest.item,
        toolUseId: "toolu_edit",
        toolName: "Edit",
        suggestions: [
          { type: "setMode", mode: "acceptEdits", destination: "session" },
        ],
      },
    } as TimelineEntry
    openConversation(
      [
        userMessage,
        {
          ...editCall,
          item: { ...editCall.item, status: "running", result: null },
        } as TimelineEntry,
        editRequest,
      ],
      "waiting"
    )

    const card = await screen.findByRole("region", {
      name: "Approval for Edit src/notes.txt",
    })

    expect(
      within(card).getByRole("button", { name: "Always allow" })
    ).toHaveAccessibleDescription(
      "Lets test-runner edit files with no request until the session ends."
    )
  })

  test("the user can answer a question, and the card then shows the answer", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/requests/q1", {}, 202)
    openConversation([userMessage, colourQuestion], "waiting")
    const card = await screen.findByRole("region", {
      name: "Which colour do you prefer?",
    })

    await user.click(within(card).getByRole("button", { name: /Red/ }))

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/requests/q1",
      body: { answers: { "Which colour do you prefer?": "Red" } },
    })
    act(() =>
      network.stream().emit(1, {
        type: "item",
        entry: {
          ...colourQuestion,
          item: {
            ...colourQuestion.item,
            status: "answered",
            answers: { "Which colour do you prefer?": "Red" },
          },
        },
      })
    )
    expect(within(card).getByText("Your answer: Red")).toBeInTheDocument()
    expect(within(card).queryByRole("button")).not.toBeInTheDocument()
  })

  test("shows a summary at the end of each turn, and Stopped for a turn that the user stopped", async () => {
    openConversation([userMessage, agentMessage, finishedTurn, stoppedTurn])

    expect(
      await screen.findByText("Done in 9.2 s · $0.012 · 7 turns")
    ).toBeInTheDocument()
    expect(screen.getByText("Stopped after 24.4 s")).toBeInTheDocument()
  })

  test("the user can stop a working agent, and the status follows the agent", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/conversations/c1/stop", {}, 202)
    openConversation([userMessage], "busy")
    await screen.findByText("Working")

    await user.click(screen.getByRole("button", { name: "Stop" }))

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/conversations/c1/stop",
      body: {},
    })
    act(() =>
      network
        .stream()
        .emit(1, { type: "agent_state", agentId: "a1", state: "idle" })
    )
    expect(screen.getByText("Online")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Stop" })
    ).not.toBeInTheDocument()
  })

  test("the user can send a message with Enter, and sees that it waits while the agent works", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/conversations/c1/messages", {}, 202)
    openConversation([userMessage], "busy")
    const box = await screen.findByRole("textbox", {
      name: "Message test-runner",
    })

    expect(
      screen.getByText(
        "test-runner is working. Your next message waits until this turn ends."
      )
    ).toBeInTheDocument()
    await user.type(box, "Run the tests.{Enter}")

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/conversations/c1/messages",
      body: { text: "Run the tests." },
    })
    expect(box).toHaveValue("")
  })
})
