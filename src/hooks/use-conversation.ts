import { useCallback, useEffect, useState } from "react"

import type {
  AgentWithState,
  Conversation,
  StreamMessage,
  TimelineEntry,
} from "@/lib/agent-api"

type ConversationView = {
  status: "loading" | "ready" | "error"
  conversation: Conversation | null
  agents: AgentWithState[]
  entries: TimelineEntry[]
}

const LOADING: ConversationView = {
  status: "loading",
  conversation: null,
  agents: [],
  entries: [],
}

export function useConversation(conversationId: string) {
  const [view, setView] = useState<ConversationView>(LOADING)

  useEffect(() => {
    let current = true
    let source: EventSource | null = null
    async function load() {
      const [detail, timeline] = await Promise.all([
        getJson<{ conversation: Conversation; agents: AgentWithState[] }>(
          `/api/conversations/${conversationId}`
        ),
        getJson<{ items: TimelineEntry[]; lastEventId: number }>(
          `/api/conversations/${conversationId}/timeline`
        ),
      ])
      if (!current) return
      setView({
        status: "ready",
        conversation: detail.conversation,
        agents: detail.agents,
        entries: timeline.items,
      })
      source = new EventSource(
        `/api/conversations/${conversationId}/events?lastEventId=${timeline.lastEventId}`
      )
      source.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StreamMessage
        if (message.type === "reset") {
          source?.close()
          start()
          return
        }
        setView((view) => applyMessage(view, message))
        if (message.type === "conversation") {
          getJson<{ agents: AgentWithState[] }>(
            `/api/conversations/${conversationId}`
          )
            .then(({ agents }) => {
              if (current) setView((view) => ({ ...view, agents }))
            })
            .catch(() => undefined)
        }
      }
    }
    function start() {
      load().catch(() => {
        if (current) setView({ ...LOADING, status: "error" })
      })
    }
    start()
    return () => {
      current = false
      source?.close()
    }
  }, [conversationId])

  const send = useCallback(
    (text: string) =>
      postJson(`/api/conversations/${conversationId}/messages`, { text }),
    [conversationId]
  )
  const answer = useCallback(
    (requestId: string, body: RequestAnswer) =>
      postJson(`/api/requests/${requestId}`, body),
    []
  )
  const stop = useCallback(
    () => postJson(`/api/conversations/${conversationId}/stop`, {}),
    [conversationId]
  )

  const stopAgent = useCallback(
    (agentId: string) =>
      postJson(
        `/api/conversations/${conversationId}/agents/${agentId}/stop`,
        {}
      ),
    [conversationId]
  )

  const newSession = useCallback(
    (agentId: string) =>
      postJson(
        `/api/conversations/${conversationId}/agents/${agentId}/sessions`,
        {}
      ),
    [conversationId]
  )

  const removeMember = useCallback(
    async (agentId: string) => {
      const url = `/api/conversations/${conversationId}/members/${agentId}`
      const response = await fetch(url, { method: "DELETE" })
      if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    },
    [conversationId]
  )

  return {
    ...view,
    send,
    answer,
    stop,
    stopAgent,
    newSession,
    removeMember,
  }
}

export type RequestAnswer =
  | { decision: "allow_once" | "always_allow" | "deny" }
  | { answers: Record<string, string> }

function applyMessage(
  view: ConversationView,
  message: StreamMessage
): ConversationView {
  if (message.type === "conversation") {
    return { ...view, conversation: message.conversation }
  }
  if (message.type === "reset") return view
  if (message.type === "agent_state") {
    return {
      ...view,
      agents: view.agents.map((agent) =>
        agent.id === message.agentId
          ? { ...agent, state: message.state }
          : agent
      ),
    }
  }
  const { entry } = message
  const known = view.entries.some((existing) => existing.id === entry.id)
  return {
    ...view,
    entries: known
      ? view.entries.map((existing) =>
          existing.id === entry.id ? entry : existing
        )
      : [...view.entries, entry],
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return (await response.json()) as T
}
