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
    await user.click(screen.getByRole("radio", { name: "acceptEdits" }))
    await user.type(
      screen.getByLabelText("Working directory"),
      "/home/user/code/web-app"
    )
    await user.type(
      screen.getByRole("spinbutton", { name: "Maximum turns" }),
      "30"
    )
    expect(
      within(screen.getByRole("region", { name: "Command" })).getByRole("code")
    ).toHaveTextContent("--max-turns 30")
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
        maxTurns: 30,
        sleepAfterMinutes: null,
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

    await waitFor(() =>
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

  test("a saved agent in the default mode shows manual, and a save sends manual", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", {
      agent: { ...testRunner, permissionMode: "default" },
    })
    network.on("PATCH", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "manual" })).toBeChecked()
    )
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(network.sent.at(-1)).toEqual({
      method: "PATCH",
      url: "/api/agents/a1",
      body: expect.objectContaining({ permissionMode: "manual" }),
    })
  })

  test("a saved agent in the auto mode keeps auto when it is saved", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", {
      agent: { ...testRunner, permissionMode: "auto" },
    })
    network.on("PATCH", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "auto" })).toBeChecked()
    )
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(network.sent.at(-1)).toEqual({
      method: "PATCH",
      url: "/api/agents/a1",
      body: expect.objectContaining({ permissionMode: "auto" }),
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
    expect(screen.getByRole("main")).not.toContainElement(alert)
    expect(window.location.pathname).toBe("/agents/new")
    expect(screen.getByRole("button", { name: "Create agent" })).toBeEnabled()
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

  test("a save with no name sends nothing, and the name shows its message", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")

    await user.click(
      await screen.findByRole("button", { name: "Create agent" })
    )

    expect(
      await screen.findByText("Give the agent a name.")
    ).toBeInTheDocument()
    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      []
    )
  })

  test("an agent with no working directory is generic, and the page says where it works", async () => {
    const user = userEvent.setup()
    const generic = { ...testRunner, cwd: null }
    network.on("POST", "/api/agents", { agent: generic }, 201)
    network.on("GET", "/api/agents/a1", { agent: generic })
    openPage("/agents/new")

    await user.type(await screen.findByLabelText("Name"), "test-runner")
    await user.click(screen.getByRole("button", { name: "Create agent" }))

    expect(
      screen.getByLabelText("Working directory")
    ).toHaveAccessibleDescription(
      "Empty: the agent works in the folder of each channel, or in a scratch folder."
    )
    expect(
      screen.getByText(/The app starts this in the folder of each channel/)
    ).toBeInTheDocument()
    expect(
      network.sent.find((request) => request.method === "POST")
    ).toMatchObject({
      body: { name: "test-runner", cwd: "" },
    })
    expect(window.location.pathname).toBe("/agents/a1")
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

  test("the page lists its sections, and each link goes to its section", async () => {
    openPage("/agents/new")
    const contents = within(
      await screen.findByRole("navigation", { name: "On this page" })
    )

    const links = contents.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Identity",
      "Model and permissions",
      "Folder and limits",
      "Tools",
      "Instructions",
      "Command",
    ])
    for (const link of links) {
      const id = link.getAttribute("href")?.replace("#", "") ?? ""
      expect(document.getElementById(id)).toHaveAccessibleName(
        link.textContent ?? ""
      )
    }
  })

  test("a save shows that it runs, and a toast says when the agent is saved", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    const release = network.hold("PATCH", "/api/agents/a1", {
      agent: testRunner,
    })
    openPage("/agents/a1")
    await waitFor(() =>
      expect(screen.getByLabelText("Working directory")).toHaveValue(
        "/home/user/code/web-app"
      )
    )

    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled()
    release()
    expect(
      await screen.findByRole("dialog", { name: "test-runner is saved." })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save agent" })).toBeEnabled()
  })

  test("after a save with errors, the bar names the fields to fix", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    await user.type(
      await screen.findByRole("spinbutton", { name: "Maximum turns" }),
      "0"
    )

    await user.click(screen.getByRole("button", { name: "Create agent" }))

    expect(
      await screen.findByText("Fix 2 fields: Name, Maximum turns.")
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText("Name"), "test-runner")
    await user.tab()
    expect(
      await screen.findByText("Fix 1 field: Maximum turns.")
    ).toBeInTheDocument()
  })

  test("a saved agent counts its unsaved changes, and discard brings back the saved values", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")
    await waitFor(() =>
      expect(screen.getByLabelText("Working directory")).toHaveValue(
        "/home/user/code/web-app"
      )
    )
    expect(screen.getByText("All changes are saved.")).toBeInTheDocument()

    await pick("Model", "claude-haiku-5-5")
    await user.type(
      screen.getByRole("spinbutton", { name: "Maximum turns" }),
      "5"
    )

    expect(screen.getByText("2 unsaved changes")).toBeInTheDocument()
    const model = within(
      screen.getByRole("region", { name: "Model and permissions" })
    )
    expect(model.getByText("Changed")).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Identity" })).queryByText(
        "Changed"
      )
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Discard" }))

    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent(
      "claude-sonnet-5-5"
    )
    expect(
      screen.getByRole("spinbutton", { name: "Maximum turns" })
    ).toHaveValue(null)
    expect(screen.getByText("All changes are saved.")).toBeInTheDocument()
    expect(model.queryByText("Changed")).not.toBeInTheDocument()
  })

  test("a usual tool goes into the allowed tools with one click", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/agents", { agent: testRunner }, 201)
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/new")
    await user.type(await screen.findByLabelText("Name"), "test-runner")
    const allowed = within(screen.getByRole("group", { name: "Allowed tools" }))

    await user.click(allowed.getByRole("button", { name: "Allow Read" }))
    await user.click(
      allowed.getByRole("button", { name: "Allow Bash(git status)" })
    )

    expect(
      allowed.getByRole("button", { name: "Remove Read" })
    ).toBeInTheDocument()
    expect(
      allowed.queryByRole("button", { name: "Allow Read" })
    ).not.toBeInTheDocument()
    expect(
      allowed.getByRole("button", { name: "Allow Edit" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Create agent" }))
    expect(
      network.sent.find((request) => request.method === "POST")
    ).toMatchObject({ body: { allowedTools: ["Read", "Bash(git status)"] } })
  })

  test("the colour is a row of swatches, and the legend names the picked colour", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    const colours = within(
      await screen.findByRole("radiogroup", { name: "Colour" })
    )
    const legend = within(screen.getByRole("group", { name: /^Colour/ }))

    expect(colours.getAllByRole("radio")).toHaveLength(6)
    expect(colours.getByRole("radio", { name: "green" })).toBeChecked()
    expect(legend.getByText("green")).toBeInTheDocument()
    expect(legend.queryByText("aqua")).not.toBeInTheDocument()

    await user.click(colours.getByRole("radio", { name: "aqua" }))

    expect(colours.getByRole("radio", { name: "aqua" })).toBeChecked()
    expect(legend.getByText("aqua")).toBeInTheDocument()
    expect(legend.queryByText("green")).not.toBeInTheDocument()
  })

  test("each permission mode is a choice that shows what the mode does", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    const modes = within(
      await screen.findByRole("radiogroup", { name: "Permission mode" })
    )

    expect(modes.getAllByRole("radio")).toHaveLength(6)
    const manual = modes.getByRole("radio", { name: "manual" })
    expect(manual).toBeChecked()
    expect(manual).toHaveAccessibleDescription(
      "With manual, each tool outside the allowed list waits for approval in the chat."
    )
    expect(
      modes.getByRole("radio", { name: "acceptEdits" })
    ).toHaveAccessibleDescription(
      "acceptEdits changes files without a prompt. Other tools outside the allowed list wait for approval in the chat."
    )
    expect(
      modes.getByRole("radio", { name: "auto" })
    ).toHaveAccessibleDescription(
      "auto lets a classifier decide each tool outside the allowed list. A tool that the classifier refuses does not run and shows as failed in the chat, with no approval card."
    )
    const dontAsk = modes.getByRole("radio", { name: "dontAsk" })
    expect(dontAsk).toHaveAccessibleDescription(
      "dontAsk never asks for approval. A tool outside the allowed list does not run and shows as failed in the chat. Read-only commands, such as ls, still run."
    )

    await user.click(dontAsk)

    expect(dontAsk).toBeChecked()
    expect(manual).not.toBeChecked()
  })

  test("the command is closed at first, and opens from its summary", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    const command = within(
      await screen.findByRole("region", { name: "Command" })
    )
    expect(command.getByRole("code", { hidden: true })).not.toBeVisible()

    await user.click(command.getByText("Command"))

    expect(command.getByRole("code")).toBeVisible()
  })

  test("the command shows how Claude Code starts the agent, follows the form, and can be copied", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")
    await waitFor(() =>
      expect(screen.getByLabelText("Working directory")).toHaveValue(
        "/home/user/code/web-app"
      )
    )
    const command = within(screen.getByRole("region", { name: "Command" }))
    await user.click(command.getByText("Command"))

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
        "  --add-dir '<uploads>' \\",
        "  --model claude-sonnet-5-5 \\",
        "  --permission-mode acceptEdits \\",
        "  --allowedTools Read 'Bash(pnpm test:*)' mcp__chat__get_conversation mcp__chat__list_conversations mcp__chat__list_agents mcp__chat__read_messages mcp__chat__list_files \\",
        "  --append-system-prompt '<rule>' \\",
        "  --resume '<session id>'",
      ].join("\n")
    )

    await pick("Model", "claude-haiku-5-5")
    await user.click(screen.getByRole("radio", { name: "auto" }))
    await user.type(screen.getByLabelText("System prompt"), "Run the tests.")

    expect(command.getByRole("code")).toHaveTextContent(
      "--model claude-haiku-5-5"
    )
    expect(command.getByRole("code")).toHaveTextContent(
      "--permission-mode auto"
    )
    expect(command.getByRole("code")).toHaveTextContent(
      "--append-system-prompt '<rule> + <system prompt>'"
    )
    await user.click(command.getByRole("button", { name: "Copy" }))
    expect(await navigator.clipboard.readText()).toBe(
      command.getByRole("code").textContent
    )
  })

  test("stop agent asks first, and then stops the agent in each conversation", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    const release = network.hold("POST", "/api/agents/a1/stop", {}, 202)
    openPage("/agents/a1")

    await user.click(await screen.findByRole("button", { name: "Stop agent" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Stop test-runner?",
    })
    expect(dialog).toHaveTextContent(
      "The next message to test-runner starts it again, and it remembers each conversation."
    )
    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      []
    )
    await user.click(within(dialog).getByRole("button", { name: "Stop agent" }))

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [{ method: "POST", url: "/api/agents/a1/stop", body: {} }]
    )
    expect(
      within(dialog).getByRole("button", { name: "Stopping…" })
    ).toBeDisabled()
    release()
    expect(
      await screen.findByRole("dialog", { name: "test-runner is stopped." })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  test("an agent with no process has no stop agent or restart, and a new agent has none", async () => {
    network.on("GET", "/api/agents", {
      agents: [reviewerBot, { ...testRunner, state: "exited" }],
    })
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    const { unmount } = openPage("/agents/a1")

    expect(
      await screen.findByRole("heading", { name: "test-runner" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Stop agent" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Restart session" })
    ).not.toBeInTheDocument()
    unmount()

    openPage("/agents/new")
    expect(
      await screen.findByRole("heading", { name: "New agent" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Stop agent" })
    ).not.toBeInTheDocument()
  })

  test("a refused stop agent shows the reason of the server, and saves nothing", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    network.on("POST", "/api/agents/a1/stop", { error: "no such agent" }, 404)
    openPage("/agents/a1")

    await user.click(await screen.findByRole("button", { name: "Stop agent" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Stop agent" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Stop agent did not work.")
    expect(alert).toHaveTextContent("no such agent")
    expect(screen.getByRole("main")).not.toContainElement(alert)
    expect(
      network.sent.filter((request) => request.method === "PATCH")
    ).toEqual([])
  })

  test("restart session asks first, and then restarts the agent with its memory", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    const release = network.hold("POST", "/api/agents/a1/restart", {}, 202)
    openPage("/agents/a1")

    await user.click(
      await screen.findByRole("button", { name: "Restart session" })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Restart test-runner?",
    })
    expect(dialog).toHaveTextContent(
      "test-runner starts again with the current configuration, and it remembers each conversation."
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Restart session" })
    )

    expect(network.sent.filter((request) => request.method === "POST")).toEqual(
      [{ method: "POST", url: "/api/agents/a1/restart", body: {} }]
    )
    expect(
      within(dialog).getByRole("button", { name: "Restarting…" })
    ).toBeDisabled()
    release()
    expect(
      await screen.findByRole("dialog", { name: "test-runner starts again." })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  test("a turn limit of 0 shows its message after the user leaves the field", async () => {
    const user = userEvent.setup()
    openPage("/agents/new")
    const turns = await screen.findByRole("spinbutton", {
      name: "Maximum turns",
    })

    await user.type(turns, "0")
    await user.tab()

    expect(turns).toHaveAccessibleDescription(
      "Give a whole number of 1 or more, or leave it empty."
    )
    expect(turns).toHaveAttribute("aria-invalid", "true")
  })

  test("a blocked ToolSearch shows its message under the blocked tools, and the agent is not saved", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")
    const add = await screen.findByLabelText("Add a blocked tool")

    await user.type(add, "ToolSearch{Enter}")
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(add).toHaveAccessibleDescription(
      "Do not block ToolSearch. Without it, each request loads the schema of each MCP tool."
    )
    expect(add).toHaveAttribute("aria-invalid", "true")
    expect(
      network.sent.filter((request) => request.method === "PATCH")
    ).toEqual([])
  })

  test("the sleep time goes to the server, and a time above 55 shows its message", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    network.on("PATCH", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")
    const sleep = await screen.findByRole("spinbutton", {
      name: "Sleep after (minutes)",
    })

    await user.type(sleep, "56")
    await user.tab()

    expect(sleep).toHaveAccessibleDescription(
      "Give a whole number from 0 to 55, or leave it empty."
    )

    await user.clear(sleep)
    await user.type(sleep, "20")
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    await waitFor(() =>
      expect(
        network.sent.find((request) => request.method === "PATCH")?.body
      ).toMatchObject({ sleepAfterMinutes: 20 })
    )
  })

  test("browse starts at the folder of the agent, and the user can move up, open a folder and use it", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    network.on("GET", "/api/folders?path=%2Fhome%2Fuser%2Fcode%2Fweb-app", {
      path: "/home/user/code/web-app",
      parent: "/home/user/code",
      folders: [{ name: "src", path: "/home/user/code/web-app/src" }],
    })
    network.on("GET", "/api/folders?path=%2Fhome%2Fuser%2Fcode", {
      path: "/home/user/code",
      parent: "/home/user",
      folders: [
        { name: "api", path: "/home/user/code/api" },
        { name: "web-app", path: "/home/user/code/web-app" },
      ],
    })
    network.on("GET", "/api/folders?path=%2Fhome%2Fuser%2Fcode%2Fapi", {
      path: "/home/user/code/api",
      parent: "/home/user/code",
      folders: [],
    })
    openPage("/agents/a1")
    const cwd = await screen.findByLabelText("Working directory")
    await waitFor(() => expect(cwd).toHaveValue("/home/user/code/web-app"))

    await user.click(screen.getByRole("button", { name: "Browse" }))
    const dialog = within(
      await screen.findByRole("dialog", { name: "Pick a folder" })
    )
    expect(
      await dialog.findByRole("button", { name: "src" })
    ).toBeInTheDocument()
    await user.click(dialog.getByRole("button", { name: "Up" }))
    await user.click(await dialog.findByRole("button", { name: "api" }))
    expect(
      await dialog.findByText("No folders in this folder.")
    ).toBeInTheDocument()
    expect(dialog.getByText("/home/user/code/api")).toBeInTheDocument()
    await user.click(dialog.getByRole("button", { name: "Use this folder" }))

    expect(cwd).toHaveValue("/home/user/code/api")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  test("browse opens the home folder when the folder in the field does not exist", async () => {
    const user = userEvent.setup()
    network.on(
      "GET",
      "/api/folders?path=%2Fnowhere",
      { error: "The folder does not exist." },
      404
    )
    network.on("GET", "/api/folders", {
      path: "/home/user",
      parent: "/home",
      folders: [{ name: "code", path: "/home/user/code" }],
    })
    openPage("/agents/new")
    await user.type(
      await screen.findByLabelText("Working directory"),
      "/nowhere"
    )

    await user.click(screen.getByRole("button", { name: "Browse" }))

    const dialog = within(
      await screen.findByRole("dialog", { name: "Pick a folder" })
    )
    expect(await dialog.findByText("/home/user")).toBeInTheDocument()
    expect(dialog.getByRole("button", { name: "code" })).toBeInTheDocument()
    expect(dialog.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("delete agent asks first, then deletes the agent and goes to the home page", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    network.on("DELETE", "/api/agents/a1", null, 204)
    openPage("/agents/a1")

    await user.click(
      await screen.findByRole("button", { name: "Delete agent" })
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete test-runner?",
    })
    expect(within(dialog).getAllByRole("listitem")[0]).toHaveTextContent(
      "test-runner is working. The turn that runs now stops."
    )
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
})
