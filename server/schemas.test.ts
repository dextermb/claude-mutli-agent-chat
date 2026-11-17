import { describe, expect, test } from "vitest"
import { agentSchema, checkBody } from "./schemas.ts"

const agent = {
  name: "foo-bar",
  model: "claude-haiku-5-5",
  permissionMode: "manual",
}

describe("agentSchema", () => {
  test("a username with a capital letter or a space is refused", () => {
    expect(checkBody(agentSchema, { ...agent, name: "Foo Bar" })).toEqual({
      ok: false,
      error: "Use only lowercase letters, numbers and hyphens in a username.",
      fields: {
        name: "Use only lowercase letters, numbers and hyphens in a username.",
      },
    })
  })

  test("an empty username asks for a username", () => {
    expect(checkBody(agentSchema, { ...agent, name: "  " })).toMatchObject({
      ok: false,
      fields: { name: "Give the agent a username." },
    })
  })

  test("a display name keeps its text, with the spaces at its ends removed", () => {
    const checked = checkBody(agentSchema, {
      ...agent,
      displayName: "  Foo Bar ",
    })

    expect(checked).toMatchObject({ ok: true, data: { displayName: "Foo Bar" } })
  })

  test("an empty or missing display name becomes null", () => {
    expect(
      checkBody(agentSchema, { ...agent, displayName: " " })
    ).toMatchObject({ ok: true, data: { displayName: null } })
    expect(checkBody(agentSchema, agent)).toMatchObject({
      ok: true,
      data: { displayName: null },
    })
  })
})
