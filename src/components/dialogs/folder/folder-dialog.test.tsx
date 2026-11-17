import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"

import { FolderDialog } from "@/components/dialogs/folder/folder-dialog"
import { fakeNetwork } from "@/test/fake-network"

const home = {
  path: "/home/dexter",
  parent: "/home",
  folders: [
    { name: "documents", path: "/home/dexter/documents" },
    { name: "claude-multi-agent", path: "/home/dexter/claude-multi-agent" },
    { name: "downloads", path: "/home/dexter/downloads" },
  ],
}

const project = {
  path: "/home/dexter/claude-multi-agent",
  parent: "/home/dexter",
  folders: [{ name: "src", path: "/home/dexter/claude-multi-agent/src" }],
}

let network: ReturnType<typeof fakeNetwork>

beforeEach(() => {
  network = fakeNetwork()
  network.on("GET", "/api/folders?path=%2Fhome%2Fdexter", home)
  network.on(
    "GET",
    "/api/folders?path=%2Fhome%2Fdexter%2Fclaude-multi-agent",
    project
  )
})

function folderNames() {
  return screen
    .getAllByRole("button")
    .map((button) => button.textContent)
    .filter(
      (name) =>
        !["Up", "Cancel", "Close", "Use this folder"].includes(name ?? "")
    )
}

describe("the folder dialog filter", () => {
  test("the user can type letters of a folder name and see only the folders that match", async () => {
    const user = userEvent.setup()
    render(
      <FolderDialog
        open
        start="/home/dexter"
        onOpenChange={() => {}}
        onPick={() => {}}
      />
    )
    await screen.findByRole("button", { name: "documents" })

    await user.type(
      screen.getByRole("textbox", { name: "Filter folders" }),
      "cma"
    )

    expect(folderNames()).toEqual(["claude-multi-agent"])
  })

  test("the user sees the closest match first", async () => {
    const user = userEvent.setup()
    render(
      <FolderDialog
        open
        start="/home/dexter"
        onOpenChange={() => {}}
        onPick={() => {}}
      />
    )
    await screen.findByRole("button", { name: "documents" })

    await user.type(
      screen.getByRole("textbox", { name: "Filter folders" }),
      "do"
    )

    expect(folderNames()).toEqual(["documents", "downloads"])
  })

  test("the user is told when no folder matches", async () => {
    const user = userEvent.setup()
    render(
      <FolderDialog
        open
        start="/home/dexter"
        onOpenChange={() => {}}
        onPick={() => {}}
      />
    )
    await screen.findByRole("button", { name: "documents" })

    await user.type(
      screen.getByRole("textbox", { name: "Filter folders" }),
      "zzz"
    )

    expect(screen.getByText("No folders match.")).toBeInTheDocument()
  })

  test("the filter clears when the user opens a folder", async () => {
    const user = userEvent.setup()
    render(
      <FolderDialog
        open
        start="/home/dexter"
        onOpenChange={() => {}}
        onPick={() => {}}
      />
    )
    await screen.findByRole("button", { name: "documents" })
    const filter = screen.getByRole("textbox", { name: "Filter folders" })
    await user.type(filter, "cma")

    await user.click(screen.getByRole("button", { name: "claude-multi-agent" }))

    await screen.findByRole("button", { name: "src" })
    expect(filter).toHaveValue("")
  })
})
