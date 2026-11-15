import { useEffect, useState } from "react"

import type {
  AgentWithState,
  Conversation,
  StreamMessage,
} from "@/lib/agent-api"

type Workspace = {
  conversations: Conversation[]
  agents: AgentWithState[]
  unread: string[]
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>({
    conversations: [],
    agents: [],
    unread: [],
  })

  useEffect(() => {
    let current = true
    let source: EventSource | null = null
    function start() {
      source = new EventSource("/api/events")
      source.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StreamMessage
        if (message.type === "reset") {
          source?.close()
          start()
          return
        }
        setWorkspace((workspace) => applyMessage(workspace, message))
      }
      load()
        .then((loaded) => {
          if (current) setWorkspace(loaded)
        })
        .catch(() => undefined)
    }
    start()
    return () => {
      current = false
      source?.close()
    }
  }, [])

  return workspace
}

async function load(): Promise<Workspace> {
  const [listed, team] = await Promise.all([
    getJson<{ conversations: Conversation[]; unread?: string[] }>(
      "/api/conversations"
    ),
    getJson<{ agents: AgentWithState[] }>("/api/agents"),
  ])
  return {
    conversations: listed.conversations,
    agents: team.agents,
    unread: listed.unread ?? [],
  }
}

function applyMessage(workspace: Workspace, message: StreamMessage): Workspace {
  if (message.type === "agent_state") {
    return {
      ...workspace,
      agents: workspace.agents.map((agent) =>
        agent.id === message.agentId
          ? { ...agent, state: message.state }
          : agent
      ),
    }
  }
  if (message.type === "unread") {
    const others = workspace.unread.filter(
      (id) => id !== message.conversationId
    )
    return {
      ...workspace,
      unread: message.unread ? [...others, message.conversationId] : others,
    }
  }
  if (message.type === "conversation") {
    const { conversation } = message
    const known = workspace.conversations.some(
      (item) => item.id === conversation.id
    )
    return {
      ...workspace,
      conversations: known
        ? workspace.conversations.map((item) =>
            item.id === conversation.id ? conversation : item
          )
        : [...workspace.conversations, conversation],
    }
  }
  return workspace
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return (await response.json()) as T
}
