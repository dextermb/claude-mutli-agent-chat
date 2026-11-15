import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "@/App"
import { testRunner } from "@/test/conversation-data"
import { fakeNetwork } from "@/test/fake-network"

let network: ReturnType<typeof fakeNetwork>

function openPage(url: string) {
  window.history.pushState({}, "", url)
  return render(<App />)
}

beforeEach(() => {
  network = fakeNetwork()
})

describe("the agent configuration page", () => {
  test("each field of a new agent reaches the request that creates it", async () => {
    const user = userEvent.setup()
    network.on("POST", "/api/agents", { agent: testRunner }, 201)
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/new")

    await user.type(await screen.findByLabelText("Name"), "test-runner")
    await user.click(screen.getByRole("radio", { name: "aqua" }))
    await user.selectOptions(
      screen.getByLabelText("Model"),
      "claude-sonnet-5-5"
    )
    await user.selectOptions(
      screen.getByLabelText("Permission mode"),
      "acceptEdits"
    )
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
    await user.type(
      screen.getByLabelText("Add a blocked tool"),
      "WebFetch{Enter}"
    )
    await user.type(
      screen.getByLabelText("System prompt"),
      "You run and fix the Vitest tests."
    )
    await user.click(screen.getByRole("button", { name: "Save agent" }))

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
  })

  test("a saved agent loads in the form, and a change goes to the server", async () => {
    const user = userEvent.setup()
    network.on("GET", "/api/agents/a1", { agent: testRunner })
    network.on("PATCH", "/api/agents/a1", { agent: testRunner })
    openPage("/agents/a1")

    const model = await screen.findByLabelText("Model")
    await vi.waitFor(() => expect(model).toHaveValue("claude-sonnet-5-5"))
    expect(screen.getByLabelText("Working directory")).toHaveValue(
      "/home/user/code/web-app"
    )
    await user.selectOptions(model, "claude-haiku-5-5")
    await user.click(screen.getByRole("button", { name: "Remove Read" }))
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(network.sent.at(-1)).toEqual({
      method: "PATCH",
      url: "/api/agents/a1",
      body: expect.objectContaining({
        model: "claude-haiku-5-5",
        allowedTools: ["Bash(pnpm test:*)"],
        cwd: "/home/user/code/web-app",
      }),
    })
  })

  test("the page shows why the server refused the agent", async () => {
    const user = userEvent.setup()
    network.on(
      "POST",
      "/api/agents",
      { error: "The server refused the agent." },
      400
    )
    openPage("/agents/new")
    await user.type(await screen.findByLabelText("Name"), "test-runner")
    await user.type(
      screen.getByLabelText("Working directory"),
      "/home/user/code/web-app"
    )

    await user.click(screen.getByRole("button", { name: "Save agent" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server refused the agent."
    )
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

    await user.click(screen.getByRole("button", { name: "Save agent" }))

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
    await user.click(screen.getByRole("button", { name: "Save agent" }))
    await screen.findByText("Use another folder.")
    network.on("POST", "/api/agents", { agent: testRunner }, 201)

    await user.type(folder, "-2")
    await user.click(screen.getByRole("button", { name: "Save agent" }))

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

    await user.click(await screen.findByRole("button", { name: "Save agent" }))

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
})
