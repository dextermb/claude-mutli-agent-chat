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
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(sessionFacts(prompt)).toBe(
      [
        "# This session",
        "",
        '- You are the agent "reviewer-bot".',
        '- This conversation is a DM between you and the user (ID "c-dm").',
        "- You get each message of the user. A mention does nothing here.",
        "- The members at the start: User, reviewer-bot (you).",
        "- You work in ~/code/web-app.",
      ].join("\n")
    )
  })

  test("an agent in a channel learns the topic, and that a mention or its own question gives it a turn", () => {
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
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(sessionFacts(prompt)).toBe(
      [
        "# This session",
        "",
        '- You are the agent "test-runner".',
        '- This conversation is the channel "#frontend" (ID "c-frontend"). Its topic: "The web app".',
        "- An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you.",
        "- The members at the start: User, reviewer-bot, test-runner (you).",
        "- You work in ~/code/web-app.",
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
      folder: { path: "~/code/web-app", from: "agent" },
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
      folder: { path: "~/code/web-app", from: "agent" },
    })

    expect(sessionFacts(prompt).split("\n")[4]).toBe(
      "- Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name."
    )
  })

  test("an agent in a channel with a folder learns that it works in the folder of the channel, with the other agents", () => {
    const prompt = environmentPrompt({
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

    expect(sessionFacts(prompt).split("\n").at(-1)).toBe(
      "- You work in ~/code/billing-api, the folder of this channel. Each agent of this channel works in the same folder."
    )
  })

  test("an agent with no folder learns that it works in an empty scratch folder with no project", () => {
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
      folder: {
        path: "~/.local/share/agent-chat/scratch/c-dm",
        from: "scratch",
      },
    })

    expect(sessionFacts(prompt).split("\n").at(-1)).toBe(
      "- You work in ~/.local/share/agent-chat/scratch/c-dm, a scratch folder of this conversation. It holds no project. Keep your notes there."
    )
  })
})
