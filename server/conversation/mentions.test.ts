import { describe, expect, test } from "vitest"
import { parseMentions } from "./mentions.ts"

const members = [
  { key: "agent:r1", name: "reviewer-bot" },
  { key: "agent:t1", name: "test-runner" },
]

describe("parseMentions", () => {
  test("finds each mentioned member in the order of the text", () => {
    expect(
      parseMentions(
        "@test-runner @reviewer-bot the router logs a key warning.",
        members
      )
    ).toEqual(["agent:t1", "agent:r1"])
  })

  test("a mention matches only a whole name, so @test-runner is not @test", () => {
    const withShortName = [...members, { key: "agent:x1", name: "test" }]

    expect(parseMentions("@test-runner run it.", withShortName)).toEqual([
      "agent:t1",
    ])
    expect(parseMentions("@test, then @test-runners.", withShortName)).toEqual([
      "agent:x1",
    ])
  })

  test("an @ inside a word is not a mention", () => {
    expect(
      parseMentions("Send it to dev@test-runner and ops@reviewer-bot.", members)
    ).toEqual([])
  })

  test("a path that starts with a member name is not a mention", () => {
    expect(
      parseMentions(
        "Read @test-runner/notes.md and @test-runner.md, thanks @test-runner.",
        members
      )
    ).toEqual(["agent:t1"])
    expect(parseMentions("See @test-runner/notes.md", members)).toEqual([])
  })
})
