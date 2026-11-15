import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { Composer } from "@/components/conversation/composer"

function renderComposer() {
  render(
    <Composer
      label="Message #release-train"
      members={["reviewer-bot", "release-bot", "test-runner"]}
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
    expect(screen.getByRole("option", { name: "release-bot" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.keyboard("{Enter}")

    expect(box).toHaveValue("ask @release-bot ")
  })

  test("the arrow keys wrap at both ends of the list, and Tab picks the active name", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@")
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("option", { name: "test-runner" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(screen.getByRole("option", { name: "release-bot" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
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
    expect(screen.getByRole("option", { name: "release-bot" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  test("the message box names the active option for a screen reader", async () => {
    const user = userEvent.setup()
    const box = renderComposer()

    await user.type(box, "@re")
    await user.keyboard("{ArrowDown}")

    expect(box).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "release-bot" }).id
    )
  })
})
