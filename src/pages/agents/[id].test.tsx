import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

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

function openPage(url: string) {
  window.history.pushState({}, "", url)
  return render(<App />)
}

async function pick(label: string, option: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("combobox", { name: label }))
  await user.click(await screen.findByRole("option", { name: option }))
}

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/conversations", {
    conversations: [releaseChannel, squadGroup, directMessage],
    unread: {},
  })
  network.on("GET", "/api/agents", {
    agents: [reviewerBot, { ...testRunner, state: "busy" }],
  })
})

describe("the agent configuration page", () => {
  test("each field of a new agent reaches the request that creates it", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/agents", { agent: testRunner }, 201)
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/new")

    await user.type(await screen.findByLabelText("Name"), "test-runner")
    await user.click(screen.getByRole("radio", { name: "aqua" }))
    await user.type(
      screen.getByLabelText("Description"),
      "Runs and fixes the Vitest tests."
    )
    await pick("Model", "claude-sonnet-5-5")
    await pick("Permission mode", "acceptEdits")
    await user.type(
      screen.getByLabelText("Working directory"),
      "/home/user/code/web-app"
    )
    await user.click(
      screen.getByRole("switch", { name: "Start when the app opens" })
    )
    await user.type(screen.getByLabelText("Add an allowed tool"), "Read{Enter}")
    await user.type(
      screen.getByLabelText("Add an allowed tool"),
      "Bash(pnpm test:*){Enter}"
    )
    await user.type(screen.getByLabelText("Add a blocked tool"), "WebFetch")
    await user.click(
      within(screen.getByRole("group", { name: "Blocked tools" })).getByRole(
        "button",
        { name: "Add" }
      )
    )
    await user.type(
      screen.getByLabelText("System prompt"),
      "You run and fix the Vitest tests."
    )
    await user.click(screen.getByRole("button", { name: "Create agent" }))

    expect(network.sent.find((request) => request.method === "POST")).toEqual({
      method: "POST",
      url: "/api/agents",
      body: {
        name: "test-runner",
        colour: "aqua",
        model: "claude-sonnet-5-5",
        permissionMode: "acceptEdits",
        cwd: "/home/user/code/web-app",
        autostart: true,
        allowedTools: ["Read", "Bash(pnpm test:*)"],
        disallowedTools: ["WebFetch"],
        systemPrompt: "You run and fix the Vitest tests.",
        description: "Runs and fixes the Vitest tests.",
      },
    })
    expect(window.location.pathname).toBe("/agents/a1")
  })

  test("an empty name shows its message after the user leaves the field", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    const name = await screen.findByLabelText("Name")
    expect(screen.queryByText("Give the agent a name.")).not.toBeInTheDocument()

    await user.click(name)
    await user.tab()

    expect(
      await screen.findByText("Give the agent a name.")
    ).toBeInTheDocument()
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveAccessibleDescription("Give the agent a name.")
  })

  test("a saved agent loads in the form, and a change goes to the server", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", {
      agent: { ...testRunner, description: "Runs the tests." },
    })
    network.on("PATCH", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")

    await vi.waitFor(() =>
      expect(screen.getByLabelText("Working directory")).toHaveValue(
        "/home/user/code/web-app"
      )
    )
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent(
      "claude-sonnet-5-5"
    )
    expect(screen.getByLabelText("Description")).toHaveValue("Runs the tests.")
    await user.clear(screen.getByLabelText("Description"))
    await user.type(
      screen.getByLabelText("Description"),
      "Runs and fixes the tests."
    )
    await pick("Model", "claude-haiku-5-5")
    await user.click(screen.getByRole("button", { name: "Remove Read" }))
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(network.sent.at(-1)).toEqual({
      method: "PATCH",
      url: "/api/agents/a1",
      body: expect.objectContaining({
        model: "claude-haiku-5-5",
        allowedTools: ["Bash(pnpm test:*)"],
        cwd: "/home/user/code/web-app",
        description: "Runs and fixes the tests.",
      }),
    })
  })

  test("the page shows why the server refused the agent", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/agents",
      { error: "The name test-runner is in use." },
      400
    )
    openPage("/agents/new")
    await user.type(await screen.findByLabelText("Name"), "test-runner")
    await user.type(
      screen.getByLabelText("Working directory"),
      "/home/user/code/web-app"
    )

    await user.click(screen.getByRole("button", { name: "Create agent" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("The server refused the agent.")
    expect(alert).toHaveTextContent("The name test-runner is in use.")
    expect(window.location.pathname).toBe("/agents/new")
  })

  test("a message of the server for a field shows under that field", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/agents",
      {
        error: "Give the folder of the agent.",
        fields: { cwd: "Give the folder of the agent." },
      },
      400
    )
    openPage("/agents/new")
    await user.type(await screen.findByLabelText("Name"), "test-runner")
    const folder = screen.getByLabelText("Working directory")
    await user.type(folder, "/home/user/code/web-app")

    await user.click(screen.getByRole("button", { name: "Create agent" }))

    await waitFor(() => expect(folder).toHaveAttribute("aria-invalid", "true"))
    expect(folder.closest("[data-slot='field']")).toHaveTextContent(
      "Give the folder of the agent."
    )
  })

  test("after a server message, a change to that field lets the user save again", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/agents",
      { error: "Pick a model.", fields: { cwd: "Use another folder." } },
      400
    )
    openPage("/agents/new")
    await user.type(await screen.findByLabelText("Name"), "test-runner")
    const folder = screen.getByLabelText("Working directory")
    await user.type(folder, "/home/user/code/web-app")
    await user.click(screen.getByRole("button", { name: "Create agent" }))
    await screen.findByText("Use another folder.")
    network.on("POST", "/api/agents", { agent: testRunner }, 201)

    await user.type(folder, "-2")
    await user.click(screen.getByRole("button", { name: "Create agent" }))

    await waitFor(() =>
      expect(
        network.sent.filter((request) => request.method === "POST")
      ).toHaveLength(2)
    )
    expect(screen.queryByText("Use another folder.")).not.toBeInTheDocument()
  })

  test("a save with empty fields sends nothing, and each empty field shows its message", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")

    await user.click(
      await screen.findByRole("button", { name: "Create agent" })
    )

    expect(
      await screen.findByText("Give the agent a name.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Give the folder of the agent.")
    ).toBeInTheDocument()
    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      []
    )
  })

  test("a new agent shows the sidebar, the way back to Agents, and Cancel", async () => {
    openPage("/agents/new")

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
    const breadcrumb = within(
      screen.getByRole("navigation", { name: "Breadcrumb" })
    )
    expect(breadcrumb.getByRole("link", { name: "Agents" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(breadcrumb.getByText("New agent")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/"
    )
  })

  test("a saved agent shows the sidebar, its status, and the conversations it is in", async () => {
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")

    expect(
      await screen.findByRole("navigation", { name: "Conversations" })
    ).toBeInTheDocument()
    expect(
      await within(
        screen.getByRole("navigation", { name: "Breadcrumb" })
      ).findByText("test-runner")
    ).toBeInTheDocument()
    const header = within(screen.getByRole("banner"))
    expect(await header.findByText("Working")).toBeInTheDocument()
    expect(
      header.getByText(
        "Headless Claude Code agent. Runs in 1 channel and 1 group chat."
      )
    ).toBeInTheDocument()
  })

  test("the description of the permission mode follows the mode", async () => {
    openPage("/agents/new")
    expect(
      await screen.findByText(
        "With default, each tool outside the allowed list waits for approval in the chat."
      )
    ).toBeInTheDocument()

    await pick("Permission mode", "acceptEdits")

    expect(
      screen.getByText(
        "acceptEdits changes files without a prompt. Other tools outside the allowed list wait for approval in the chat."
      )
    ).toBeInTheDocument()
  })

  test("the command shows how Claude Code starts the agent, follows the form, and can be copied", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")
    await vi.waitFor(() =>
      expect(screen.getByLabelText("Working directory")).toHaveValue(
        "/home/user/code/web-app"
      )
    )
    const command = within(screen.getByRole("region", { name: "Command" }))

    expect(
      command.getByText(
        "The app starts this in /home/user/code/web-app for each conversation."
      )
    ).toBeInTheDocument()
    expect(command.getByRole("code").textContent).toBe(
      [
        "claude -p \\",
        "  --input-format stream-json \\",
        "  --output-format stream-json \\",
        "  --verbose \\",
        "  --include-partial-messages \\",
        "  --replay-user-messages \\",
        "  --permission-prompt-tool stdio \\",
        "  --setting-sources user,project \\",
        "  --plugin-dir '<chat plugin>' \\",
        "  --mcp-config '<chat server>' \\",
        "  --model claude-sonnet-5-5 \\",
        "  --permission-mode acceptEdits \\",
        "  --allowedTools Read 'Bash(pnpm test:*)' mcp__chat__get_conversation mcp__chat__list_conversations mcp__chat__list_agents mcp__chat__read_messages \\",
        "  --append-system-prompt '<rule>' \\",
        "  --resume '<session id>'",
      ].join("\n")
    )

    await pick("Model", "claude-haiku-5-5")
    await user.type(screen.getByLabelText("System prompt"), "Run the tests.")

    expect(command.getByRole("code")).toHaveTextContent(
      "--model claude-haiku-5-5"
    )
    expect(command.getByRole("code")).toHaveTextContent(
      "--append-system-prompt '<rule> + <system prompt>'"
    )
    await user.click(command.getByRole("button", { name: "Copy" }))
    expect(await navigator.clipboard.readText()).toBe(
      command.getByRole("code").textContent
    )
  })
})
