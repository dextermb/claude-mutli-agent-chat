import { describe, expect, test } from "vitest"
import { environmentPrompt } from "./environment-prompt.ts"

function sessionFacts(prompt: string): string {
  return prompt.split(/\n\n(?=# )/)[0]
}

describe("environmentPrompt", () => {
  test("an agent in a DM learns its name, its conversation and that it gets each message", () => {
    const prompt = environmentPrompt({
      agentName: "reviewer-bot",
      conversation: {
        id: "c-dm",
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        replyMode: "every",
      },
      memberNames: ["User", "reviewer-bot"],
    })

    expect(sessionFacts(prompt)).toBe(
      [
        "# This session",
        "",
        '- You are the agent "reviewer-bot".',
        '- This conversation is a DM between you and the user (ID "c-dm").',
        "- You get each message of the user. A mention does nothing here.",
        "- The members at the start: User, reviewer-bot (you).",
      ].join("\n")
    )
  })

  test("an agent in a channel learns the topic and that only a mention gives it a turn", () => {
    const prompt = environmentPrompt({
      agentName: "test-runner",
      conversation: {
        id: "c-frontend",
        kind: "channel",
        name: "frontend",
        topic: "The web app",
        replyMode: "mention",
      },
      memberNames: ["User", "reviewer-bot", "test-runner"],
    })

    expect(sessionFacts(prompt)).toBe(
      [
        "# This session",
        "",
        '- You are the agent "test-runner".',
        '- This conversation is the channel "#frontend" (ID "c-frontend"). Its topic: "The web app".',
        "- An agent gets a turn only when a message mentions it with @name.",
        "- The members at the start: User, reviewer-bot, test-runner (you).",
      ].join("\n")
    )
  })

  test("an agent in a group chat learns the name of the group chat", () => {
    const prompt = environmentPrompt({
      agentName: "reviewer-bot",
      conversation: {
        id: "c-group",
        kind: "group",
        name: "reviewer-bot, test-runner",
        topic: null,
        replyMode: "mention",
      },
      memberNames: ["User", "reviewer-bot", "test-runner"],
    })

    expect(sessionFacts(prompt).split("\n")[3]).toBe(
      '- This conversation is the group chat "reviewer-bot, test-runner" (ID "c-group").'
    )
  })

  test("an agent in a channel that answers every message learns that it gets each message of the user", () => {
    const prompt = environmentPrompt({
      agentName: "test-runner",
      conversation: {
        id: "c-standup",
        kind: "channel",
        name: "standup",
        topic: null,
        replyMode: "every",
      },
      memberNames: ["User", "test-runner"],
    })

    expect(sessionFacts(prompt).split("\n")[4]).toBe(
      "- Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name."
    )
  })
})
