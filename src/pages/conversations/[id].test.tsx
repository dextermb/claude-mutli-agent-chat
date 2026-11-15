import { act, render, screen, waitFor, within } from "@testing-library/react"
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
  stoppedCall,
  pushRequest,
  rateLimitNotice,
  sessionStart,
  readCall,
  releaseChannel,
  reviewerBot,
  squadGroup,
  stoppedTurn,
  subagentRead,
  testRunner,
  testRunnerSession,
  userMessage,
} from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"
import { screenWidth, windowFocus } from "@/test/fake-screen"

let network: ReturnType<typeof fakeNetwork>

function openConversation(
  entries: TimelineEntry[],
  state = testRunner.state,
  unread: Record<string, number> = {}
) {
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
    unread,
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
  network.on("GET", "/api/conversations/c1/agents/a1/session", {
    session: { ...testRunnerSession, state },
  })
  window.history.pushState({}, "", "/conversations/c1")
  return render(<App />)
}

function openChannel(entries: TimelineEntry[]) {
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
  })
  network.on("GET", "/api/agents", { agents: [reviewerBot, testRunner] })
  network.on("GET", "/api/conversations/ch1", {
    conversation: releaseChannel,
    agents: [{ ...testRunner, state: "busy" }, reviewerBot],
  })
  network.on("GET", "/api/conversations/ch1/timeline", {
    items: entries,
    lastEventId: 0,
  })
  window.history.pushState({}, "", "/conversations/ch1")
  return render(<App />)
}

type Shown = "complementary" | "dialog"

async function openMembers(
  user: ReturnType<typeof userEvent.setup>,
  shown: Shown = "complementary"
) {
  const header = within(await screen.findByRole("banner"))
  await user.click(header.getByRole("button", { name: /^Members:/ }))
  return within(await screen.findByRole(shown, { name: "Members" }))
}

async function openMember(
  user: ReturnType<typeof userEvent.setup>,
  row: string,
  shown: Shown = "complementary"
) {
  const members = await openMembers(user, shown)
  await user.click(members.getByRole("button", { name: row }))
  return within(
    await members.findByRole("region", {
      name: `Session of ${row.split(" ")[0]}`,
    })
  )
}

beforeEach(() => {
  network = fakeNetwork()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("the DM page", () => {
  test("shows the agent, its status, and the messages of the conversation", async () => {
    openConversation([userMessage, agentMessage])

    expect(
      await screen.findByRole("heading", { name: "test-runner" })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("banner")).getByText("Idle")
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

  test("a DM starts with a line that names the agent, the reply rule and its folder", async () => {
    openConversation([userMessage])

    expect(await screen.findByText(/This is your DM with/)).toHaveTextContent(
      "This is your DM with test-runner. In a DM, the agent replies to every message. It runs Claude Code in /home/user/code/web-app."
    )
  })

  test("an agent whose process failed says that the next message starts it again", async () => {
    openConversation([userMessage, failedNotice], "failed")

    expect(
      await screen.findByText(
        "test-runner stopped. Your next message starts it again and resumes the session."
      )
    ).toBeInTheDocument()
  })

  test("Configure in the header of a DM opens the agent page", async () => {
    openConversation([userMessage])

    const header = within(await screen.findByRole("banner"))
    expect(header.getByRole("link", { name: "Configure" })).toHaveAttribute(
      "href",
      "/agents/a1"
    )
  })

  test("an agent whose process has exited shows Stopped, as in the design", async () => {
    openConversation([userMessage], "exited")

    await screen.findByRole("heading", { name: "test-runner" })
    expect(
      within(screen.getByRole("banner")).getByText("Stopped")
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

  test("the session card shows the model, the mode, the folder, the session id, the turns and the cost", async () => {
    openConversation([userMessage])

    const panel = await screen.findByRole("complementary", { name: "Session" })

    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole("term")
          .map((term) => [
            term.textContent,
            term.nextElementSibling?.textContent,
          ])
      ).toEqual([
        ["Model", "claude-sonnet-5-5"],
        ["Permissions", "acceptEdits"],
        ["Directory", "~/code/web-app"],
        ["Session ID", "4f1c9a2e"],
        ["Turns", "7"],
        ["Cost", "$0.18"],
      ])
    )
    expect(within(panel).getByText("Bash(pnpm test:*)")).toBeInTheDocument()
  })

  test("before the first process, the session card shows the configuration of the agent and no session id", async () => {
    openConversation([])
    network.on("GET", "/api/conversations/c1/agents/a1/session", {
      session: {
        ...testRunnerSession,
        claudeSessionId: null,
        state: "exited",
        turns: 0,
        costUsd: 0,
      },
    })

    const panel = await screen.findByRole("complementary", { name: "Session" })

    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole("term")
          .map((term) => [
            term.textContent,
            term.nextElementSibling?.textContent,
          ])
      ).toEqual([
        ["Model", "claude-sonnet-5-5"],
        ["Permissions", "acceptEdits"],
        ["Directory", "~/code/web-app"],
        ["Session ID", "None yet"],
        ["Turns", "0"],
        ["Cost", "$0.000"],
      ])
    )
    expect(
      within(panel).queryByRole("button", { name: "Copy session ID" })
    ).not.toBeInTheDocument()
  })

  test("the user can copy the full session id from the session card", async () => {
    const user = userEvent.setup()
    openConversation([userMessage])
    const panel = await screen.findByRole("complementary", { name: "Session" })

    await user.click(
      await within(panel).findByRole("button", { name: "Copy session ID" })
    )

    expect(await navigator.clipboard.readText()).toBe(
      "4f1c9a2e-7b3d-4e5f-8a6b-1c2d3e4f5a6b"
    )
  })

  test("stop turn in the session card stops this agent, and shows only while it works", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/conversations/c1/agents/a1/stop", {}, 202)
    openConversation([userMessage], "busy")
    const panel = await screen.findByRole("complementary", { name: "Session" })

    await user.click(
      await within(panel).findByRole("button", { name: "Stop turn" })
    )

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations/c1/agents/a1/stop",
          body: {},
        },
      ]
    )
    act(() =>
      network
        .stream("/api/conversations/c1/events")
        .emit(1, { type: "agent_state", agentId: "a1", state: "idle" })
    )
    expect(
      within(panel).queryByRole("button", { name: "Stop turn" })
    ).not.toBeInTheDocument()
  })

  test("new session asks first, and then starts a new session for the agent", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations/c1/agents/a1/sessions",
      { session: { ...testRunnerSession, turns: 0 } },
      201
    )
    openConversation([userMessage])
    const panel = await screen.findByRole("complementary", { name: "Session" })

    await user.click(within(panel).getByRole("button", { name: "New session" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Start a new session?",
    })
    expect(dialog).toHaveTextContent(
      "test-runner forgets this conversation. The messages stay here."
    )
    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      []
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Start new session" })
    )

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations/c1/agents/a1/sessions",
          body: {},
        },
      ]
    )
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  test("a new session shows as a divider with its time, between the messages", async () => {
    openConversation([
      userMessage,
      agentMessage,
      { ...sessionStart, createdAt: localTime(15, 14, 30) },
      { ...userMessage, id: "u2", seq: 20 },
    ])

    const divider = await screen.findByText("New session · 14:30")

    expect(divider.closest("article")).toBeNull()
    expect(screen.getAllByRole("article")).toHaveLength(3)
  })

  test("the session card says when the agent configuration changed after the process started", async () => {
    openConversation([userMessage])
    network.on("GET", "/api/conversations/c1/agents/a1/session", {
      session: { ...testRunnerSession, configChanged: true },
    })

    const panel = await screen.findByRole("complementary", { name: "Session" })

    expect(
      await within(panel).findByText(
        "The configuration changed. Start a new session to use it."
      )
    ).toBeInTheDocument()
  })

  test("the files tab lists each file that the agent read or changed, and keeps the tab in the address", async () => {
    const user = userEvent.setup()
    openConversation([userMessage, readCall, editCall])

    await user.click(await screen.findByRole("tab", { name: "Files" }))

    const table = await screen.findByRole("table", { name: "Files" })
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent)
        )
    ).toEqual([["src/notes.txt", "Edited", "+1 −1", "14:05"]])
    expect(screen.getByRole("heading", { name: "1 file" })).toBeInTheDocument()
    expect(window.location.search).toBe("?tab=files")
  })

  test("a file that the agent only read has no line changes", async () => {
    const user = userEvent.setup()
    openConversation([userMessage, readCall])

    await user.click(await screen.findByRole("tab", { name: "Files" }))

    const table = await screen.findByRole("table", { name: "Files" })
    expect(
      within(within(table).getAllByRole("row")[1])
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["src/notes.txt", "Read", "none", "14:05"])
  })

  test("a click on a file goes to the messages and to the last tool call on that file", async () => {
    const user = userEvent.setup()
    openConversation([userMessage, readCall, editCall])
    await user.click(await screen.findByRole("tab", { name: "Files" }))

    await user.click(
      await screen.findByRole("button", { name: "src/notes.txt" })
    )

    expect(screen.getByRole("tab", { name: "Messages" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Edit src/notes.txt" })
      ).toHaveFocus()
    )
  })

  test("the session log tab shows each line of the agent, and follows new lines", async () => {
    const user = userEvent.setup()
    const at = (seconds: number) =>
      new Date(2026, 10, 15, 14, 5, seconds).toISOString()
    openConversation([userMessage])
    network.on("GET", "/api/conversations/c1/agents/a1/log", {
      lines: [
        {
          seq: 1,
          sessionId: "s1",
          direction: "in",
          at: at(1),
          text: '{"type":"control_request","request_id":"initialize-1","request":{"subtype":"initialize"}}',
        },
        {
          seq: 2,
          sessionId: "s1",
          direction: "out",
          at: at(2),
          text: '{"type":"system","subtype":"init","session_id":"4f1c9a2e"}',
        },
      ],
    })

    await user.click(await screen.findByRole("tab", { name: "Session log" }))
    const log = await screen.findByRole("list", { name: "Session log" })
    const rows = () =>
      within(log)
        .getAllByRole("listitem")
        .map((row) => row.querySelector("summary, p")?.textContent)
    await waitFor(() =>
      expect(rows()).toEqual([
        "Process started · 14:05",
        "14:05:01 in control_request initialize",
        "14:05:02 out system/init",
      ])
    )

    act(() =>
      network.stream("/api/conversations/c1/events").emit(0, {
        type: "line",
        agentId: "a1",
        line: {
          seq: 3,
          sessionId: "s1",
          direction: "out",
          at: at(9),
          text: '{"type":"result","subtype":"success"}',
        },
      })
    )

    expect(rows().at(-1)).toBe("14:05:09 out result/success")
  })

  test("the session log loads earlier lines when the first page is full", async () => {
    const user = userEvent.setup()
    const line = (seq: number) => ({
      seq,
      sessionId: "s1",
      direction: "out",
      at: new Date(2026, 10, 15, 14, 5, 0).toISOString(),
      text: `{"type":"system","subtype":"status","n":${seq}}`,
    })
    openConversation([userMessage])
    network.on("GET", "/api/conversations/c1/agents/a1/log", {
      lines: Array.from({ length: 200 }, (_, index) => line(index + 11)),
    })
    network.on("GET", "/api/conversations/c1/agents/a1/log?before=11", {
      lines: [line(9), line(10)],
    })
    await user.click(await screen.findByRole("tab", { name: "Session log" }))

    await user.click(
      await screen.findByRole("button", { name: "Load earlier lines" })
    )

    const log = screen.getByRole("list", { name: "Session log" })
    await waitFor(() =>
      expect(within(log).getAllByRole("listitem")).toHaveLength(203)
    )
    expect(
      screen.queryByRole("button", { name: "Load earlier lines" })
    ).not.toBeInTheDocument()
  })

  test("shows a message while it arrives, and marks it busy until it is complete", async () => {
    openConversation([userMessage])
    await screen.findByText("Fix the flaky auth test.")
    const piece = {
      ...agentMessage,
      item: { ...agentMessage.item, text: "I will use", status: "streaming" },
    } as TimelineEntry

    act(() =>
      network
        .stream("/api/conversations/c1/events")
        .emit(1, { type: "item", entry: piece })
    )

    expect(screen.getByText("I will use")).toHaveAttribute("aria-busy", "true")
    act(() =>
      network
        .stream("/api/conversations/c1/events")
        .emit(2, { type: "item", entry: agentMessage })
    )
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

  test("text between backticks in a message shows as code", async () => {
    openConversation([
      userMessage,
      {
        ...agentMessage,
        item: {
          kind: "message",
          id: "item-1",
          text: "The test reads `Date.now()` twice. Use a `fixed clock`, not a `.",
          status: "done",
        },
      },
    ])

    expect(
      await screen.findByText("Date.now()", { selector: "code" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("fixed clock", { selector: "code" })
    ).toBeInTheDocument()
    expect(screen.getAllByText(/twice\. Use a/)).toHaveLength(1)
    expect(screen.getByText(/, not a `\.$/)).toBeInTheDocument()
  })

  test("a tool call that a stop ended says Stopped", async () => {
    openConversation([userMessage, stoppedCall])

    const ping = await screen.findByRole("region", {
      name: "Bash ping -c 30 127.0.0.1",
    })
    expect(within(ping).getByText("Stopped")).toBeInTheDocument()
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
      screen.getByText(
        "test-runner needs your approval. Your next message waits until this turn ends."
      )
    ).toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: "Allow once" }))

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/requests/r1",
      body: { decision: "allow_once" },
    })
    act(() =>
      network.stream("/api/conversations/c1/events").emit(1, {
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
    expect(
      screen.getByText(
        "test-runner waits for your answer. Your next message waits until this turn ends."
      )
    ).toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: /Red/ }))

    expect(network.sent.at(-1)).toEqual({
      method: "POST",
      url: "/api/requests/q1",
      body: { answers: { "Which colour do you prefer?": "Red" } },
    })
    act(() =>
      network.stream("/api/conversations/c1/events").emit(1, {
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
        .stream("/api/conversations/c1/events")
        .emit(1, { type: "agent_state", agentId: "a1", state: "idle" })
    )
    expect(
      within(screen.getByRole("banner")).getByText("Idle")
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
      within(sidebar).getByRole("button", { name: "reviewer-bot Idle" })
    ).toBeInTheDocument()
  })

  test("the sidebar follows the state of each agent, and counts the agents that work", async () => {
    openConversation([userMessage], "busy")
    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })
    await within(sidebar).findByRole("button", { name: "reviewer-bot Idle" })
    expect(within(sidebar).getByText("1 agent working")).toBeInTheDocument()

    act(() =>
      network
        .stream("/api/events")
        .emit(1, { type: "agent_state", agentId: "a2", state: "waiting" })
    )

    expect(
      within(sidebar).getByRole("button", {
        name: "reviewer-bot Needs approval",
      })
    ).toBeInTheDocument()
    expect(
      within(sidebar).getByText("1 agent working · 1 needs approval")
    ).toBeInTheDocument()
  })

  test("in a channel, the members button opens the members, and a click on an agent opens its session", async () => {
    const user = userEvent.setup()
    openChannel([userMessage])
    network.on("GET", "/api/conversations/ch1/agents/a2/session", {
      session: { ...testRunnerSession, permissionMode: "plan" },
    })
    const header = within(await screen.findByRole("banner"))
    const button = header.getByRole("button", {
      name: "Members: 1 person, 2 agents",
    })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()

    const members = await openMembers(user)
    expect(button).toHaveAttribute("aria-expanded", "true")
    expect(members.getByText("1 person · 2 agents")).toBeInTheDocument()
    await user.click(members.getByRole("button", { name: "reviewer-bot Idle" }))

    const session = within(
      await members.findByRole("region", { name: "Session of reviewer-bot" })
    )
    expect(await session.findByText("plan")).toBeInTheDocument()
    expect(
      members.getByRole("button", { name: "reviewer-bot Idle" })
    ).toHaveAttribute("aria-expanded", "true")
    await user.click(members.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  })

  test("in a channel, invite agents adds the picked agents that are not members", async () => {
    const user = userEvent.setup()
    const docsWriter = { ...reviewerBot, id: "a3", name: "docs-writer" }
    openChannel([userMessage])
    network.on("GET", "/api/agents", {
      agents: [docsWriter, reviewerBot, testRunner],
    })
    network.on("POST", "/api/conversations/ch1/members", {
      conversation: releaseChannel,
    })
    const members = await openMembers(user)

    await user.click(members.getByRole("button", { name: "Invite agents" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite agents" })
    expect(dialog).toHaveAccessibleDescription(
      "A new member sees only the messages after it joins. It replies when someone @mentions it."
    )
    await waitFor(() =>
      expect(
        within(dialog)
          .getAllByRole("checkbox")
          .map((box) => box.getAttribute("aria-label"))
      ).toEqual(["Invite docs-writer"])
    )
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Invite docs-writer" })
    )
    expect(within(dialog).getByText("1 picked")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Invite" }))

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [
        {
          method: "POST",
          url: "/api/conversations/ch1/members",
          body: { agentIds: ["a3"] },
        },
      ]
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  test("in a channel, the panel of an agent can remove that agent from the channel", async () => {
    const user = userEvent.setup()
    openChannel([userMessage])
    network.on("GET", "/api/conversations/ch1/agents/a2/session", {
      session: testRunnerSession,
    })
    network.on("DELETE", "/api/conversations/ch1/members/a2", {
      conversation: releaseChannel,
    })
    const session = await openMember(user, "reviewer-bot Idle")

    await user.click(session.getByRole("button", { name: "Remove" }))

    expect(
      network.sent.filter((request) => request.method === "DELETE")
    ).toEqual([
      {
        method: "DELETE",
        url: "/api/conversations/ch1/members/a2",
        body: undefined,
      },
    ])
    expect(
      screen.queryByRole("region", { name: "Session of reviewer-bot" })
    ).not.toBeInTheDocument()
  })

  test("in a channel, channel settings sends the changed fields, and the header follows the stream", async () => {
    const user = userEvent.setup()
    const changed = { ...releaseChannel, topic: "Ship v2.5 on Monday." }
    openChannel([userMessage])
    network.on("PATCH", "/api/conversations/ch1", { conversation: changed })
    const header = within(await screen.findByRole("banner"))

    await user.click(header.getByRole("button", { name: "Channel settings" }))
    const dialog = within(
      await screen.findByRole("dialog", { name: "Channel settings" })
    )
    const topic = dialog.getByRole("textbox", { name: "Topic" })
    expect(topic).toHaveValue("Ship v2.4 on Friday.")
    await user.clear(topic)
    await user.type(topic, "Ship v2.5 on Monday.")
    await user.click(dialog.getByRole("button", { name: "Save" }))

    expect(
      network.sent.filter((request) => request.method === "PATCH")
    ).toEqual([
      {
        method: "PATCH",
        url: "/api/conversations/ch1",
        body: { topic: "Ship v2.5 on Monday." },
      },
    ])
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    act(() =>
      network
        .stream("/api/conversations/ch1/events")
        .emit(1, { type: "conversation", conversation: changed })
    )
    expect(header.getByText("Ship v2.5 on Monday.")).toBeInTheDocument()
  })

  test("the header of a channel says when the agents reply, and follows a change of the reply mode", async () => {
    openChannel([userMessage])
    const header = within(await screen.findByRole("banner"))

    expect(
      header.getByText("Agents reply when you @mention them.")
    ).toBeInTheDocument()
    act(() =>
      network.stream("/api/conversations/ch1/events").emit(1, {
        type: "conversation",
        conversation: { ...releaseChannel, replyMode: "every" },
      })
    )
    expect(
      header.getByText("Agents reply to every message.")
    ).toBeInTheDocument()
  })

  test("a refused save keeps the dialog open and shows the reason of the server", async () => {
    const user = userEvent.setup()
    openChannel([userMessage])
    network.on(
      "PATCH",
      "/api/conversations/ch1",
      { error: "Pick a reply mode." },
      400
    )
    const header = within(await screen.findByRole("banner"))

    await user.click(header.getByRole("button", { name: "Channel settings" }))
    const dialog = within(
      await screen.findByRole("dialog", { name: "Channel settings" })
    )
    await user.click(dialog.getByRole("radio", { name: /^Every message/ }))
    await user.click(dialog.getByRole("button", { name: "Save" }))

    expect(
      await dialog.findByText("The server did not save the settings.")
    ).toBeInTheDocument()
    expect(dialog.getByText("Pick a reply mode.")).toBeInTheDocument()
    expect(network.sent.at(-1)).toEqual({
      method: "PATCH",
      url: "/api/conversations/ch1",
      body: { replyMode: "every" },
    })
  })

  test("a group chat and a DM have no channel settings", async () => {
    const user = userEvent.setup()
    openConversation([userMessage])
    network.on("GET", "/api/conversations/g1", {
      conversation: squadGroup,
      agents: [testRunner, reviewerBot],
    })
    network.on("GET", "/api/conversations/g1/timeline", {
      items: [],
      lastEventId: 0,
    })
    const dmHeader = within(await screen.findByRole("banner"))
    expect(
      dmHeader.queryByRole("button", { name: "Channel settings" })
    ).not.toBeInTheDocument()

    const sidebar = screen.getByRole("navigation", { name: "Conversations" })
    await user.click(
      within(sidebar).getByRole("link", { name: squadGroup.name })
    )

    await screen.findByRole("heading", { name: squadGroup.name })
    const groupHeader = within(screen.getByRole("banner"))
    expect(
      groupHeader.queryByRole("button", { name: "Channel settings" })
    ).not.toBeInTheDocument()
  })

  test("in a channel, the divider of a new session names the agent", async () => {
    openChannel([
      userMessage,
      { ...sessionStart, createdAt: localTime(15, 14, 30) },
    ])

    expect(
      await screen.findByText("New session for test-runner · 14:30")
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
    expect(
      header.getByRole("button", { name: "Members: 1 person, 2 agents" })
    ).toBeInTheDocument()
    expect(header.getByRole("button", { name: "Stop all" })).toBeInTheDocument()
    expect(
      screen.getByText("test-runner is working. reviewer-bot is idle.")
    ).toBeInTheDocument()
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
    const suggestions = within(screen.getByRole("listbox", { name: "Members" }))
    expect(suggestions.getAllByRole("option")).toEqual([
      suggestions.getByRole("option", { name: "test-runner Idle" }),
    ])
    await user.keyboard("{Tab}")
    expect(box).toHaveValue("Please @test-runner ")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

    await user.type(box, "and @")
    await user.click(screen.getByRole("option", { name: "reviewer-bot Idle" }))
    expect(box).toHaveValue("Please @test-runner and @reviewer-bot ")
  })
})

describe("a refused action", () => {
  function openGroupOfOne() {
    const group = { ...squadGroup, members: ["user:me", "agent:a1"] }
    network.on("GET", "/api/conversations", { conversations: [group] })
    network.on("GET", "/api/agents", { agents: [testRunner] })
    network.on("GET", "/api/conversations/g1", {
      conversation: group,
      agents: [testRunner],
    })
    network.on("GET", "/api/conversations/g1/timeline", {
      items: [userMessage],
      lastEventId: 0,
    })
    network.on("GET", "/api/conversations/g1/agents/a1/session", {
      session: testRunnerSession,
    })
    window.history.pushState({}, "", "/conversations/g1")
    return render(<App />)
  }

  test("remove of the last agent of a group chat shows the reason of the server, and the panel stays", async () => {
    const user = userEvent.setup()
    network.on(
      "DELETE",
      "/api/conversations/g1/members/a1",
      { error: "A group chat needs one agent or more." },
      400
    )
    openGroupOfOne()
    const session = await openMember(user, "test-runner Idle")

    await user.click(session.getByRole("button", { name: "Remove" }))

    const alert = await session.findByRole("alert")
    expect(alert).toHaveTextContent("Remove did not work.")
    expect(alert).toHaveTextContent("A group chat needs one agent or more.")
  })
  test("a refused stop turn shows the reason of the server in the session panel", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations/c1/agents/a1/stop",
      { error: "no such agent in this conversation" },
      404
    )
    openConversation([userMessage], "busy")
    const panel = await screen.findByRole("complementary", { name: "Session" })

    await user.click(
      await within(panel).findByRole("button", { name: "Stop turn" })
    )

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "no such agent in this conversation"
    )
  })

  test("new session shows that the server did not answer when no answer comes", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations/c1/agents/a1/sessions")
    openConversation([userMessage])
    const panel = await screen.findByRole("complementary", { name: "Session" })

    await user.click(within(panel).getByRole("button", { name: "New session" }))
    await user.click(
      within(
        await screen.findByRole("alertdialog", { name: "Start a new session?" })
      ).getByRole("button", { name: "Start new session" })
    )

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "The server did not answer."
    )
  })

  test("the user can close the reason of a refused action", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations/c1/agents/a1/stop")
    openConversation([userMessage], "busy")
    const panel = await screen.findByRole("complementary", { name: "Session" })
    await user.click(
      await within(panel).findByRole("button", { name: "Stop turn" })
    )
    const alert = await within(panel).findByRole("alert")

    await user.click(
      within(alert).getByRole("button", { name: "Close the alert" })
    )

    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
  })

  test("the reason of a refused action closes when the next action works", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations/c1/agents/a1/stop")
    openConversation([userMessage], "busy")
    const panel = await screen.findByRole("complementary", { name: "Session" })
    const stopTurn = await within(panel).findByRole("button", {
      name: "Stop turn",
    })
    await user.click(stopTurn)
    await within(panel).findByRole("alert")

    network.on("POST", "/api/conversations/c1/agents/a1/stop", {}, 202)
    await user.click(stopTurn)

    await waitFor(() =>
      expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
    )
  })

  test("the reason of a refused action stays with its agent", async () => {
    const user = userEvent.setup()
    openChannel([userMessage])
    network.on("GET", "/api/conversations/ch1/agents/a1/session", {
      session: testRunnerSession,
    })
    network.on("GET", "/api/conversations/ch1/agents/a2/session", {
      session: testRunnerSession,
    })
    network.fail("DELETE", "/api/conversations/ch1/members/a2")
    const session = await openMember(user, "reviewer-bot Idle")
    await user.click(session.getByRole("button", { name: "Remove" }))
    await session.findByRole("alert")

    await user.click(
      screen.getByRole("button", { name: "test-runner Working" })
    )

    expect(
      within(
        await screen.findByRole("region", { name: "Session of test-runner" })
      ).queryByRole("alert")
    ).not.toBeInTheDocument()
  })

  test("a refused stop shows the reason of the server over the message box", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/conversations/c1/stop",
      { error: "no such conversation" },
      404
    )
    openConversation([userMessage], "busy")
    await screen.findByRole("heading", { name: "test-runner" })

    await user.click(screen.getByRole("button", { name: "Stop" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("no such conversation")
    expect(
      within(
        screen.getByRole("complementary", { name: "Session" })
      ).queryByRole("alert")
    ).not.toBeInTheDocument()
  })

  test("a message that the server did not get shows that over the message box", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations/c1/messages")
    openConversation([userMessage])
    const box = await screen.findByRole("textbox", {
      name: "Message test-runner",
    })

    await user.type(box, "Run the tests.{Enter}")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server did not answer."
    )
  })

  test("a refused answer to an approval shows the reason of the server over the message box", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/requests/r1", { error: "no open request" }, 404)
    openConversation([userMessage, pushCall, pushRequest], "waiting")
    const card = await screen.findByRole("region", {
      name: "Approval for Bash git push origin release-train",
    })

    await user.click(within(card).getByRole("button", { name: "Allow once" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no open request"
    )
  })

  test("invite agents says that the server did not answer when no answer comes", async () => {
    const user = userEvent.setup()
    const docsWriter = { ...reviewerBot, id: "a3", name: "docs-writer" }
    openChannel([userMessage])
    network.on("GET", "/api/agents", {
      agents: [docsWriter, reviewerBot, testRunner],
    })
    network.fail("POST", "/api/conversations/ch1/members")
    const members = await openMembers(user)
    await user.click(members.getByRole("button", { name: "Invite agents" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite agents" })

    await user.click(
      await within(dialog).findByRole("checkbox", {
        name: "Invite docs-writer",
      })
    )
    await user.click(within(dialog).getByRole("button", { name: "Invite" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The server did not answer. The agents were not added."
    )
  })

  test("the reason of a refused action does not follow the user to another conversation", async () => {
    const user = userEvent.setup()
    network.fail("POST", "/api/conversations/c1/stop")
    network.on("GET", "/api/conversations/ch1", {
      conversation: releaseChannel,
      agents: [testRunner, reviewerBot],
    })
    network.on("GET", "/api/conversations/ch1/timeline", {
      items: [],
      lastEventId: 0,
    })
    openConversation([userMessage], "busy")
    await screen.findByRole("heading", { name: "test-runner" })
    await user.click(screen.getByRole("button", { name: "Stop" }))
    await screen.findByRole("alert")

    const sidebar = screen.getByRole("navigation", { name: "Conversations" })
    await user.click(
      within(sidebar).getByRole("link", { name: "release-train" })
    )

    await screen.findByRole("heading", { name: "release-train" })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("a narrow screen", () => {
  test("a wide screen shows the sidebar as a column, with no button to open it", async () => {
    screenWidth(1280)
    openConversation([userMessage])
    const header = within(await screen.findByRole("banner"))

    expect(
      screen.getByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
    expect(
      header.queryByRole("button", { name: "Open the sidebar" })
    ).not.toBeInTheDocument()
  })

  test("a chat that the user starts from the sidebar closes the sidebar", async () => {
    const user = userEvent.setup()
    screenWidth(375)
    network.on("POST", "/api/conversations", { conversation: squadGroup }, 201)
    network.on("GET", "/api/conversations/g1", {
      conversation: squadGroup,
      agents: [reviewerBot, testRunner],
    })
    network.on("GET", "/api/conversations/g1/timeline", {
      items: [],
      lastEventId: 0,
    })
    openConversation([userMessage])
    const header = within(await screen.findByRole("banner"))
    await user.click(header.getByRole("button", { name: "Open the sidebar" }))
    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })

    await user.click(
      within(sidebar).getByRole("button", { name: "Start a chat" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Start a chat" })
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick reviewer-bot" })
    )
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pick test-runner" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Start group chat" })
    )

    await screen.findByRole("heading", { name: "reviewer-bot, test-runner" })
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
  })

  test("the sidebar opens from a button in the header, and closes when the user picks a conversation", async () => {
    const user = userEvent.setup()
    screenWidth(375)
    network.on("GET", "/api/conversations/ch1", {
      conversation: releaseChannel,
      agents: [testRunner, reviewerBot],
    })
    network.on("GET", "/api/conversations/ch1/timeline", {
      items: [],
      lastEventId: 0,
    })
    openConversation([userMessage])
    const header = within(await screen.findByRole("banner"))
    expect(
      screen.queryByRole("navigation", { name: "Conversations" })
    ).not.toBeInTheDocument()

    await user.click(header.getByRole("button", { name: "Open the sidebar" }))
    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })
    await user.click(
      await within(sidebar).findByRole("link", { name: "release-train" })
    )

    await screen.findByRole("heading", { name: "release-train" })
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Conversations" })
      ).not.toBeInTheDocument()
    )
  })

  test("in a DM, the session button opens the session panel as a sheet", async () => {
    const user = userEvent.setup()
    screenWidth(375)
    openConversation([userMessage])
    const header = within(await screen.findByRole("banner"))
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()

    await user.click(header.getByRole("button", { name: "Session" }))

    const sheet = await screen.findByRole("dialog", { name: "Session" })
    expect(
      await within(sheet).findByText("claude-sonnet-5-5")
    ).toBeInTheDocument()
  })

  test("in a channel, the members open as a sheet, and Close closes it", async () => {
    const user = userEvent.setup()
    screenWidth(375)
    openChannel([userMessage])
    network.on("GET", "/api/conversations/ch1/agents/a2/session", {
      session: testRunnerSession,
    })
    const header = within(await screen.findByRole("banner"))

    const session = await openMember(user, "reviewer-bot Idle", "dialog")
    expect(await session.findByText("acceptEdits")).toBeInTheDocument()
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
    await user.click(
      within(screen.getByRole("dialog", { name: "Members" })).getByRole(
        "button",
        { name: "Close" }
      )
    )

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(header.getByRole("button", { name: /^Members:/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  test("a wide screen shows the session panel at the side, with no session button", async () => {
    screenWidth(1280)
    openConversation([userMessage])
    const header = within(await screen.findByRole("banner"))

    expect(
      await screen.findByRole("complementary", { name: "Session" })
    ).toBeInTheDocument()
    expect(
      header.queryByRole("button", { name: "Session" })
    ).not.toBeInTheDocument()
  })
})

describe("unread rows", () => {
  test("the sidebar counts the unread items of each conversation in which an agent wrote after the last visit", async () => {
    openConversation([userMessage], "idle", { ch1: 2 })
    const sidebar = await screen.findByRole("navigation", {
      name: "Conversations",
    })

    expect(
      await within(sidebar).findByRole("link", {
        name: "release-train 2 unread",
      })
    ).toHaveAttribute("href", "/conversations/ch1")
    expect(within(sidebar).getByText("2")).toBeInTheDocument()
    expect(
      within(sidebar).getByRole("link", { name: "reviewer-bot, test-runner" })
    ).toBeInTheDocument()
  })

  test("the sidebar follows the unread events of the app stream", async () => {
    openConversation([userMessage])
    const sidebar = within(
      await screen.findByRole("navigation", { name: "Conversations" })
    )
    await sidebar.findByRole("link", { name: "release-train" })

    act(() =>
      network
        .stream("/api/events")
        .emit(1, { type: "unread", conversationId: "ch1", count: 1 })
    )
    expect(
      sidebar.getByRole("link", { name: "release-train 1 unread" })
    ).toBeInTheDocument()

    act(() =>
      network
        .stream("/api/events")
        .emit(2, { type: "unread", conversationId: "ch1", count: 0 })
    )
    expect(
      sidebar.getByRole("link", { name: "release-train" })
    ).toBeInTheDocument()
  })

  test("an open conversation in a focused window counts as seen up to its last entry", async () => {
    windowFocus(true)
    network.on("POST", "/api/conversations/c1/read", {}, 204)

    openConversation([userMessage, agentMessage])

    await waitFor(() =>
      expect(
        network.sent.filter((request) => request.url.endsWith("/read"))
      ).toEqual([
        { method: "POST", url: "/api/conversations/c1/read", body: { seq: 2 } },
      ])
    )
  })

  test("a conversation in a window without the focus counts as seen when the window gets the focus", async () => {
    network.on("POST", "/api/conversations/c1/read", {}, 204)
    openConversation([userMessage, agentMessage])
    await screen.findByRole("heading", { name: "test-runner" })
    expect(
      network.sent.filter((request) => request.url.endsWith("/read"))
    ).toEqual([])

    windowFocus(true)
    act(() => {
      window.dispatchEvent(new FocusEvent("focus"))
    })

    await waitFor(() =>
      expect(
        network.sent.filter((request) => request.url.endsWith("/read"))
      ).toEqual([
        { method: "POST", url: "/api/conversations/c1/read", body: { seq: 2 } },
      ])
    )
  })

  test("a new entry in a focused window counts as seen at once", async () => {
    windowFocus(true)
    network.on("POST", "/api/conversations/c1/read", {}, 204)
    openConversation([userMessage])
    await screen.findByRole("heading", { name: "test-runner" })

    act(() =>
      network
        .stream("/api/conversations/c1/events")
        .emit(1, { type: "item", entry: agentMessage })
    )

    await waitFor(() =>
      expect(
        network.sent
          .filter((request) => request.url.endsWith("/read"))
          .map((request) => request.body)
      ).toEqual([{ seq: 1 }, { seq: 2 }])
    )
  })

  test("the row of the open conversation is never marked unread", async () => {
    openConversation([userMessage], "idle", { c1: 1 })
    const sidebar = within(
      await screen.findByRole("navigation", { name: "Conversations" })
    )

    expect(
      await sidebar.findByRole("link", { name: "test-runner Idle" })
    ).toHaveAttribute("aria-current", "page")
  })
})
