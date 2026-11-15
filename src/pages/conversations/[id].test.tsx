import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "@/App"
import type { TimelineEntry } from "@/lib/agent-api"
import {
  agentCall,
  agentMessage,
  bashCall,
  colourQuestion,
  deniedCall,
  directMessage,
  editCall,
  failedNotice,
  finishedTurn,
  localTime,
  pushCall,
  pushRequest,
  rateLimitNotice,
  readCall,
  releaseChannel,
  reviewerBot,
  squadGroup,
  stoppedTurn,
  subagentRead,
  testRunner,
  userMessage,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

function openConversation(entries: TimelineEntry[], state = testRunner.state) {
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
  })
  network.on("GET", "/api/agents", {
    agents: [reviewerBot, { ...testRunner, state }],
  })
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
  vi.useRealTimers()
})

describe("the DM page", () => {
  test("shows the agent, its status, and the messages of the conversation", async () => {
    openConversation([userMessage, agentMessage])

    expect(
      await screen.findByRole("heading", { name: "test-runner" })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("banner")).getByText("Online")
    ).toBeInTheDocument()
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

  test("shows the time of each message next to its author, as hours and minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(localTime(15, 16, 0)))
    openConversation([userMessage, agentMessage])

    const messages = await screen.findAllByRole("article")

    expect(within(messages[0]).getByText("14:03")).toHaveAttribute(
      "datetime",
      userMessage.createdAt
    )
    expect(within(messages[1]).getByText("14:04")).toBeInTheDocument()
  })

  test("a heading names the day before the first message of each day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(localTime(15, 16, 0)))
    openConversation([
      { ...userMessage, createdAt: localTime(13, 9, 30) },
      { ...agentMessage, createdAt: localTime(13, 9, 31) },
      { ...userMessage, id: "u2", seq: 3, createdAt: localTime(14, 11, 0) },
      {
        ...agentMessage,
        id: "s1/item-9",
        seq: 4,
        createdAt: localTime(15, 8, 0),
      },
    ])

    await screen.findAllByRole("article")

    expect(
      within(screen.getByRole("main"))
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual(["Friday 13 November", "Yesterday", "Today"])
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

  test("the tool calls of a subagent show inside its Agent card, behind a button", async () => {
    const user = userEvent.setup()
    openConversation([agentCall, subagentRead])

    const card = await screen.findByRole("region", {
      name: "Agent Read notes.txt first line",
    })
    expect(
      screen.queryByRole("region", { name: "Read src/notes.txt" })
    ).not.toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: "1 tool call" }))

    expect(
      within(card).getByRole("region", { name: "Read src/notes.txt" })
    ).toBeInTheDocument()
  })

  test("a subagent call that waits for approval shows its approval without a click", async () => {
    openConversation([
      agentCall,
      {
        ...subagentRead,
        item: { ...subagentRead.item, status: "running" },
      } as TimelineEntry,
      {
        ...pushRequest,
        id: "s1/item-14",
        item: {
          ...pushRequest.item,
          toolUseId: "toolu_subagent_read",
          toolName: "Read",
        },
      } as TimelineEntry,
    ])

    const card = await screen.findByRole("region", {
      name: "Agent Read notes.txt first line",
    })

    expect(
      within(card).getByRole("button", { name: "1 tool call" })
    ).toHaveAttribute("aria-expanded", "true")
    expect(
      within(card).getByRole("button", { name: "Allow once" })
    ).toBeInTheDocument()
  })

  test("a rate limit that is reached shows a notice with the time when it resets", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(localTime(15, 12, 0)))
    openConversation([rateLimitNotice])

    expect(
      await screen.findByText(
        "The five-hour rate limit is reached. It resets at 14:00."
      )
    ).toBeInTheDocument()
  })

  test("a rate limit that resets on a later day names that day in its notice", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(localTime(15, 12, 0)))
    openConversation([
      {
        ...rateLimitNotice,
        item: {
          ...rateLimitNotice.item,
          status: "allowed_warning",
          rateLimitType: "seven_day",
          resetsAt: new Date(localTime(17, 9, 0)).getTime() / 1000,
        },
      } as TimelineEntry,
    ])

    expect(
      await screen.findByText(
        "The seven-day rate limit is near. It resets on Tuesday 17 November at 09:00."
      )
    ).toBeInTheDocument()
  })

  test("a process that fails shows a notice, and the details show what it wrote to stderr", async () => {
    const user = userEvent.setup()
    openConversation([failedNotice])

    expect(
      await screen.findByText(
        "test-runner stopped with an error (exit code 1)."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/the SessionStart hook failed/)
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show details" }))

    expect(screen.getByText(/at hook\.js:4/)).toHaveTextContent(
      "Error: the SessionStart hook failed at hook.js:4"
    )
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
    await screen.findByRole("heading", { name: "test-runner" })
    expect(
      within(screen.getByRole("banner")).getByText("Working")
    ).toBeInTheDocument()

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
    expect(
      within(screen.getByRole("banner")).getByText("Online")
    ).toBeInTheDocument()
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

  test("the sidebar lists the channels, the group chats and the agents with their status", async () => {
    openConversation([userMessage], "busy")

    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })
    expect(
      await within(sidebar).findByRole("link", { name: "release-train" })
    ).toHaveAttribute("href", "/conversations/ch1")
    expect(
      within(sidebar).getByRole("link", { name: "reviewer-bot, test-runner" })
    ).toHaveAttribute("href", "/conversations/g1")
    const current = within(sidebar).getByRole("link", {
      name: "test-runner Working",
    })
    expect(current).toHaveAttribute("href", "/conversations/c1")
    expect(current).toHaveAttribute("aria-current", "page")
    expect(
      within(sidebar).getByRole("button", { name: "reviewer-bot Online" })
    ).toBeInTheDocument()
  })

  test("a channel shows its topic, each agent with its status, and the author of each message", async () => {
    network.on("GET", "/api/conversations", {
      conversations: [releaseChannel, squadGroup, directMessage],
    })
    network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
    network.on("GET", "/api/conversations/ch1", {
      conversation: releaseChannel,
      agents: [{ ...testRunner, state: "busy" }, reviewerBot],
    })
    network.on("GET", "/api/conversations/ch1/timeline", {
      items: [
        {
          ...userMessage,
          item: { ...userMessage.item, text: "@reviewer-bot review PR 212." },
        },
        {
          ...agentMessage,
          id: "s2/item-1",
          authorKey: "agent:a2",
          item: { ...agentMessage.item, text: "@test-runner add a test." },
        },
        agentMessage,
      ],
      lastEventId: 0,
    })
    window.history.pushState({}, "", "/conversations/ch1")
    render(<App />)

    const header = within(await screen.findByRole("banner"))
    expect(
      header.getByRole("heading", { name: "release-train" })
    ).toBeInTheDocument()
    expect(header.getByText("Ship v2.4 on Friday.")).toBeInTheDocument()
    const members = header.getByRole("list", {
      name: "Agents in this conversation",
    })
    expect(
      within(members)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["test-runner Working", "reviewer-bot Online"])
    const messages = screen.getAllByRole("article")
    expect(within(messages[1]).getByText("reviewer-bot")).toBeInTheDocument()
    expect(within(messages[2]).getByText("test-runner")).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Message #release-train" })
    ).toBeInTheDocument()
  })

  test("the message box suggests the agents after @, and the user can pick one", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/conversations", { conversations: [releaseChannel] })
    network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
    network.on("GET", "/api/conversations/ch1", {
      conversation: releaseChannel,
      agents: [testRunner, reviewerBot],
    })
    network.on("GET", "/api/conversations/ch1/timeline", {
      items: [],
      lastEventId: 0,
    })
    window.history.pushState({}, "", "/conversations/ch1")
    render(<App />)
    const box = await screen.findByRole("textbox", {
      name: "Message #release-train",
    })

    await user.type(box, "Please @te")
    const suggestions = screen.getByRole("listbox", { name: "Mention" })
    expect(
      within(suggestions)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["test-runner"])
    await user.keyboard("{Tab}")
    expect(box).toHaveValue("Please @test-runner ")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

    await user.type(box, "and @")
    await user.click(screen.getByRole("option", { name: "reviewer-bot" }))
    expect(box).toHaveValue("Please @test-runner and @reviewer-bot ")
  })
})
