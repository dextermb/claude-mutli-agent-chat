import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { Composer } from "@/components/conversation/composer/composer"
import { reviewerBot, testRunner } from "@/test/conversation-data"

const releaseBot = {
  ...reviewerBot,
  id: "a3",
  name: "release-bot",
  state: "busy" as const,
}

function renderComposer() {
  render(
    <Composer
      label="Message #release-train"
      members={[reviewerBot, releaseBot, testRunner]}
      onSend={() => undefined}
    />
  )
  return screen.getByRole("textbox", { name: "Message #release-train" })
}

describe("the mention list of the composer", () => {
  test("the user can move down the list with the arrow key and pick with Enter", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "ask @re")
    await user.keyboard("{ArrowDown}")
    expect(
      screen.getByRole("option", { name: "release-bot Working" })
    ).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{Enter}")

    expect(box).toHaveValue("ask @release-bot ")
  })

  test("the arrow keys wrap at both ends of the list, and Tab picks the active name", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@")
    await user.keyboard("{ArrowUp}")
    expect(
      screen.getByRole("option", { name: "test-runner Idle" })
    ).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(
      screen.getByRole("option", { name: "release-bot Working" })
    ).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{Tab}")

    expect(box).toHaveValue("@release-bot ")
  })

  test("Escape closes the list until the user types the next character", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@re")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

    await user.type(box, "l")
    expect(
      screen.getByRole("option", { name: "release-bot Working" })
    ).toHaveAttribute("aria-selected", "true")
  })

  test("the message box names the active option for a screen reader", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@re")
    await user.keyboard("{ArrowDown}")

    expect(box).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "release-bot Working" }).id
    )
  })

  test("each name in the list shows the status of its agent", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@")

    expect(screen.getAllByRole("option")).toEqual([
      screen.getByRole("option", { name: "reviewer-bot Idle" }),
      screen.getByRole("option", { name: "release-bot Working" }),
      screen.getByRole("option", { name: "test-runner Idle" }),
    ])
    expect(screen.getByRole("listbox", { name: "Members" })).toBeInTheDocument()
  })

  test("the user finds an agent by its display name, and the pick puts its username in the message", async () => {
    const user = userEvent.setup()
    render(
      <Composer
        label="Message #release-train"
        members={[
          reviewerBot,
          { ...releaseBot, displayName: "Ship Captain" },
          testRunner,
        ]}
        onSend={() => undefined}
      />
    )
    const box = screen.getByRole("textbox", { name: "Message #release-train" })

    await user.type(box, "ask @ship")
    expect(screen.getAllByRole("option")).toEqual([
      screen.getByRole("option", {
        name: "Ship Captain @release-bot Working",
      }),
    ])
    await user.keyboard("{Enter}")

    expect(box).toHaveValue("ask @release-bot ")
  })
})
