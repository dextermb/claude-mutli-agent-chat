import { describe, expect, test } from "vitest"
import { shownName, slugOf } from "./agent-names.ts"

describe("slugOf", () => {
  test.each([
    ["test-runner", "test-runner"],
    ["Test Runner", "test-runner"],
    ["Ops_Bot 2", "ops-bot-2"],
    ["  --Café  Bot--  ", "caf-bot"],
    ["!!!", "agent"],
  ])("%j becomes %j", (name, slug) => {
    expect(slugOf(name)).toBe(slug)
  })
})

describe("shownName", () => {
  test("an agent with a display name shows its display name", () => {
    expect(shownName({ name: "foo-bar", displayName: "Foo Bar" })).toBe(
      "Foo Bar"
    )
  })

  test("an agent with no display name shows its username", () => {
    expect(shownName({ name: "foo-bar", displayName: null })).toBe("foo-bar")
  })
})
