import { existsSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { ENVIRONMENT_RULE, sessionFacts } from "./environment-prompt.ts"

const user = { name: "User", displayName: null }

function named(name: string, displayName: string | null = null) {
  return { name, displayName }
}

describe("sessionFacts", () => {
  test("an agent with a display name learns both names, and so do its members", () => {
    const facts = sessionFacts({
      agent: named("test-runner", "Test Runner"),
      conversation: {
        id: "c-frontend",
        kind: "channel",
        name: "frontend",
        topic: null,
        replyMode: "mention",
      },
      members: [user, named("reviewer-bot"), named("test-runner", "Test Runner")],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts[0]).toBe('- You are the agent "Test Runner" (@test-runner).')
    expect(facts[3]).toBe(
      "- The members: User, reviewer-bot, Test Runner (@test-runner) (you)."
    )
  })

  test("an agent in a DM learns its name, its conversation and that it gets each message", () => {
    const facts = sessionFacts({
      agent: named("reviewer-bot"),
      conversation: {
        id: "c-dm",
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        replyMode: "every",
      },
      members: [user, named("reviewer-bot")],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts).toEqual([
      '- You are the agent "reviewer-bot".',
      '- This conversation is a DM between you and the user (ID "c-dm").',
      "- You get each message of the user. A mention does nothing here.",
      "- The members: User, reviewer-bot (you).",
      "- You work in ~/code/web-app.",
    ])
  })

  test("an agent in a channel learns the topic, and that a mention or its own question gives it a turn", () => {
    const facts = sessionFacts({
      agent: named("test-runner"),
      conversation: {
        id: "c-frontend",
        kind: "channel",
        name: "frontend",
        topic: "The web app",
        replyMode: "mention",
      },
      members: [user, named("reviewer-bot"), named("test-runner")],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts).toEqual([
      '- You are the agent "test-runner".',
      '- This conversation is the channel "#frontend" (ID "c-frontend"). Its topic: "The web app".',
      "- An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you.",
      "- The members: User, reviewer-bot, test-runner (you).",
      "- You work in ~/code/web-app.",
    ])
  })

  test("an agent in a group chat learns the name of the group chat", () => {
    const facts = sessionFacts({
      agent: named("reviewer-bot"),
      conversation: {
        id: "c-group",
        kind: "group",
        name: "reviewer-bot, test-runner",
        topic: null,
        replyMode: "mention",
      },
      members: [user, named("reviewer-bot"), named("test-runner")],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts[1]).toBe(
      '- This conversation is the group chat "reviewer-bot, test-runner" (ID "c-group").'
    )
  })

  test("an agent in a channel that answers every message learns that it gets each message of the user", () => {
    const facts = sessionFacts({
      agent: named("test-runner"),
      conversation: {
        id: "c-standup",
        kind: "channel",
        name: "standup",
        topic: null,
        replyMode: "every",
      },
      members: [user, named("test-runner")],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts[2]).toBe(
      "- Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name."
    )
  })

  test("an agent in a channel with a folder learns that it works in the folder of the channel, with the other agents", () => {
    const facts = sessionFacts({
      agent: named("test-runner"),
      conversation: {
        id: "c-billing",
        kind: "channel",
        name: "billing-api",
        topic: null,
        replyMode: "mention",
      },
      members: [user, named("reviewer-bot"), named("test-runner")],
      folder: { path: "~/code/billing-api", from: "channel" },
    })

    expect(facts.at(-1)).toBe(
      "- You work in ~/code/billing-api, the folder of this channel. Each agent of this channel works in the same folder."
    )
  })

  test("an agent with no folder learns that it works in an empty scratch folder with no project", () => {
    const facts = sessionFacts({
      agent: named("reviewer-bot"),
      conversation: {
        id: "c-dm",
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        replyMode: "every",
      },
      members: [user, named("reviewer-bot")],
      folder: {
        path: "~/.local/share/agent-chat/scratch/c-dm",
        from: "scratch",
      },
    })

    expect(facts.at(-1)).toBe(
      "- You work in ~/.local/share/agent-chat/scratch/c-dm, a scratch folder of this conversation. It holds no project. Keep your notes there."
    )
  })
})

describe("ENVIRONMENT_RULE", () => {
  test("each chat skill that the rule names has its SKILL.md in the chat plugin", () => {
    const named = [...ENVIRONMENT_RULE.matchAll(/`chat:([a-z-]+)`/g)].map(
      (match) => match[1]
    )

    expect(named.length).toBeGreaterThan(0)
    for (const name of new Set(named)) {
      expect(
        existsSync(
          new URL(`../../agent/skills/${name}/SKILL.md`, import.meta.url)
        ),
        `chat:${name}`
      ).toBe(true)
    }
  })
})
