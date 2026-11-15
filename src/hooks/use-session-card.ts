import { useEffect, useState } from "react"

import type { SessionCard } from "@/lib/agent-api"

export function useSessionCard(
  conversationId: string,
  agentId: string | undefined,
  version: string
) {
  const [card, setCard] = useState<SessionCard | null>(null)

  useEffect(() => {
    if (!agentId) return
    let current = true
    fetch(`/api/conversations/${conversationId}/agents/${agentId}/session`)
      .then((response) => response.json() as Promise<{ session: SessionCard }>)
      .then(({ session }) => {
        if (current) setCard(session)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [conversationId, agentId, version])

  return card
}
