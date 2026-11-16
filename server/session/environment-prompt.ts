import { readFileSync } from "node:fs"
import type { Conversation } from "../api-types.ts"

export type EnvironmentContext = {
  agentName: string
  conversation: Pick<
    Conversation,
    "id" | "kind" | "name" | "topic" | "replyMode"
  >
  memberNames: string[]
  folder: { path: string; from: "channel" | "agent" | "scratch" }
}

export const ENVIRONMENT_RULE = readFileSync(
  new URL("../../agent/environment.md", import.meta.url),
  "utf8"
).trim()

export function sessionFacts({
  agentName,
  conversation,
  memberNames,
  folder,
}: EnvironmentContext): string[] {
  const members = memberNames.map((name) =>
    name === agentName ? `${name} (you)` : name
  )
  return [
    `- You are the agent "${agentName}".`,
    `- This conversation is ${place(conversation)} (ID "${conversation.id}").${topic(conversation)}`,
    turns(conversation),
    `- The members: ${members.join(", ")}.`,
    workFolder(folder),
  ]
}

export function factsNote(
  sent: string[] | null,
  now: string[]
): string | undefined {
  if (!sent) return ["[Chat app] This session:", ...now].join("\n")
  const changed = now.filter((line, index) => line !== sent[index])
  if (changed.length === 0) return undefined
  return ["[Chat app] This session changed:", ...changed].join("\n")
}

function workFolder({ path, from }: EnvironmentContext["folder"]): string {
  if (from === "channel") {
    return `- You work in ${path}, the folder of this channel. Each agent of this channel works in the same folder.`
  }
  if (from === "scratch") {
    return `- You work in ${path}, a scratch folder of this conversation. It holds no project. Keep your notes there.`
  }
  return `- You work in ${path}.`
}

function place({ kind, name }: EnvironmentContext["conversation"]): string {
  if (kind === "dm") return "a DM between you and the user"
  if (kind === "group") return `the group chat "${name}"`
  return `the channel "#${name}"`
}

function topic({ topic }: EnvironmentContext["conversation"]): string {
  return topic ? ` Its topic: "${topic}".` : ""
}

function turns({
  kind,
  replyMode,
}: EnvironmentContext["conversation"]): string {
  if (kind === "dm") {
    return "- You get each message of the user. A mention does nothing here."
  }
  if (replyMode === "every") {
    return "- Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name."
  }
  return "- An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you."
}
