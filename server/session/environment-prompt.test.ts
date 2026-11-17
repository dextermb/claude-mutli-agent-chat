import { existsSync } from "node:fs"
import { describe, expect, test } from "vitest"
import {
  ENVIRONMENT_RULE,
  rulesNote,
  sessionFacts,
} from "./environment-prompt.ts"

describe("sessionFacts", () => {
  test("an agent in a DM learns its name, its conversation and that it gets each message", () => {
    const facts = sessionFacts({
      agentName: "reviewer-bot",
      conversation: {
        id: "c-dm",
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        replyMode: "every",
      },
      memberNames: ["User", "reviewer-bot"],
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
      agentName: "test-runner",
      conversation: {
        id: "c-frontend",
        kind: "channel",
        name: "frontend",
        topic: "The web app",
        replyMode: "mention",
      },
      memberNames: ["User", "reviewer-bot", "test-runner"],
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
      agentName: "reviewer-bot",
      conversation: {
        id: "c-group",
        kind: "group",
        name: "reviewer-bot, test-runner",
        topic: null,
        replyMode: "mention",
      },
      memberNames: ["User", "reviewer-bot", "test-runner"],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts[1]).toBe(
      '- This conversation is the group chat "reviewer-bot, test-runner" (ID "c-group").'
    )
  })

  test("an agent in a channel that answers every message learns that it gets each message of the user", () => {
    const facts = sessionFacts({
      agentName: "test-runner",
      conversation: {
        id: "c-standup",
        kind: "channel",
        name: "standup",
        topic: null,
        replyMode: "every",
      },
      memberNames: ["User", "test-runner"],
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(facts[2]).toBe(
      "- Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name."
    )
  })

  test("an agent in a channel with a folder learns that it works in the folder of the channel, with the other agents", () => {
    const facts = sessionFacts({
      agentName: "test-runner",
      conversation: {
        id: "c-billing",
        kind: "channel",
        name: "billing-api",
        topic: null,
        replyMode: "mention",
      },
      memberNames: ["User", "reviewer-bot", "test-runner"],
      folder: { path: "~/code/billing-api", from: "channel" },
    })

    expect(facts.at(-1)).toBe(
      "- You work in ~/code/billing-api, the folder of this channel. Each agent of this channel works in the same folder."
    )
  })

  test("an agent with no folder learns that it works in an empty scratch folder with no project", () => {
    const facts = sessionFacts({
      agentName: "reviewer-bot",
      conversation: {
        id: "c-dm",
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        replyMode: "every",
      },
      memberNames: ["User", "reviewer-bot"],
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

describe("rulesNote", () => {
  test("the first prompt in a channel with rules gives the rules in full", () => {
    expect(
      rulesNote(undefined, "Do not edit files.\nWrite findings only.", "channel")
    ).toBe(
      "[Chat app] The rules of this channel, from the user:\nDo not edit files.\nWrite findings only."
    )
  })

  test("a later prompt with the same rules gives no block", () => {
    expect(
      rulesNote("Write findings only.", "Write findings only.", "channel")
    ).toBeUndefined()
  })

  test("a change of the rules in a group chat gives the new rules in full", () => {
    expect(
      rulesNote("Write findings only.", "Reply in French.", "group")
    ).toBe(
      "[Chat app] The user changed the rules of this group chat. The rules now:\nReply in French."
    )
  })

  test("a removal of the rules tells the agent that no rules apply now", () => {
    expect(rulesNote("Write findings only.", null, "channel")).toBe(
      "[Chat app] The user removed the rules of this channel."
    )
  })

  test("a conversation with no rules gives no block", () => {
    expect(rulesNote(undefined, null, "group")).toBeUndefined()
  })
})
