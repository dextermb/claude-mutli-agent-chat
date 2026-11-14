import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { App } from "@/App"

function renderAt(url: string) {
  window.history.pushState({}, "", url)
  return render(<App />)
}

describe("landing page", () => {
  it("shows a count of 0 at first", async () => {
    renderAt("/")
    expect(
      await screen.findByRole("spinbutton", { name: "Count" })
    ).toHaveValue(0)
  })

  it("lets the user increase the count", async () => {
    const user = userEvent.setup()
    renderAt("/")

    await user.click(await screen.findByRole("button", { name: "Increase" }))
    await user.click(screen.getByRole("button", { name: "Increase" }))

    expect(screen.getByRole("spinbutton", { name: "Count" })).toHaveValue(2)
  })

  it("lets the user decrease the count below zero", async () => {
    const user = userEvent.setup()
    renderAt("/")

    await user.click(await screen.findByRole("button", { name: "Decrease" }))

    expect(screen.getByRole("spinbutton", { name: "Count" })).toHaveValue(-1)
  })

  it("lets the user type a count, then step from it", async () => {
    const user = userEvent.setup()
    renderAt("/")

    const input = await screen.findByRole("spinbutton", { name: "Count" })
    await user.clear(input)
    await user.type(input, "41")
    await user.click(screen.getByRole("button", { name: "Increase" }))

    expect(input).toHaveValue(42)
  })
})

describe("routing", () => {
  it("shows a not-found page for an unknown URL", async () => {
    renderAt("/no-such-page")
    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
  })
})
