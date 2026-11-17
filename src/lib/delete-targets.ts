import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { shownName } from "../../server/agent-names.ts"

export type DeleteTarget = {
  title: string
  action: string
  url: string
  points: string[]
  conversationIds: string[]
}

export function conversationTarget(
  conversation: Conversation,
  agents: AgentWithState[]
): DeleteTarget {
  const channel = conversation.kind === "channel"
  const name = channel ? `#${conversation.name}` : conversation.name
  const members = agents
    .filter((agent) => conversation.members.includes(`agent:${agent.id}`))
    .map(shownName)
  return {
    title: channel ? `Delete ${name}?` : "Delete this group chat?",
    action: channel ? "Delete channel" : "Delete group chat",
    url: `/api/conversations/${conversation.id}`,
    conversationIds: [conversation.id],
    points: [
      `The messages and the shared files of ${name} are deleted.`,
      ...(members.length > 0
        ? [
            `The sessions of ${listOf(members)} in it end. A turn that runs now stops.`,
            "The agents stay. Their DMs and their other conversations do not change.",
          ]
        : []),
    ],
  }
}

export function agentTarget(
  agent: AgentWithState,
  conversations: Conversation[]
): DeleteTarget {
  const memberKey = `agent:${agent.id}`
  const joined = conversations.filter((item) =>
    item.members.includes(memberKey)
  )
  const lastAgentIn = (item: Conversation) =>
    item.kind === "dm" ||
    (item.kind === "group" &&
      !item.members.some(
        (key) => key !== memberKey && key.startsWith("agent:")
      ))
  const gone = joined.filter(lastAgentIn)
  const left = joined.filter((item) => !lastAgentIn(item))
  const working = agent.state === "busy" || agent.state === "waiting"
  const nameOf = (item: Conversation) =>
    item.kind === "channel" ? `#${item.name}` : item.name
  const groups = gone.filter((item) => item.kind === "group")
  const name = shownName(agent)
  return {
    title: `Delete ${name}?`,
    action: "Delete agent",
    url: `/api/agents/${agent.id}`,
    conversationIds: gone.map((item) => item.id),
    points: [
      ...(working ? [`${name} is working. The turn that runs now stops.`] : []),
      ...(left.length > 0
        ? [
            `${name} leaves ${listOf(left.map(nameOf))}. Its messages there stay, with the label "Deleted agent".`,
          ]
        : []),
      ...groups.map(
        (item) =>
          `The group chat ${item.name} is deleted, because ${name} is its last agent.`
      ),
      `The DM with ${name} and its sessions are deleted.`,
      ...(agent.cwd ? [`The files in ${agent.cwd} stay.`] : []),
    ],
  }
}

function listOf(names: string[]): string {
  if (names.length < 2) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}
