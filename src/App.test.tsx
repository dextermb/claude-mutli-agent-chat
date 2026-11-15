import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "@/App"

function renderAt(url: string) {
  window.history.pushState({}, "", url)
  return render(<App />)
}

describe("routing", () => {
  it("shows a not-found page for an unknown URL", async () => {
    renderAt("/no-such-page")
    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
  })
})
