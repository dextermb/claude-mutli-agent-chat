import { useEffect } from "react"

export function useMarkRead(conversationId: string, lastSeq?: number) {
  useEffect(() => {
    function markRead() {
      if (lastSeq === undefined || !document.hasFocus()) return
      fetch(`/api/conversations/${conversationId}/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seq: lastSeq }),
      }).catch(() => undefined)
    }
    markRead()
    window.addEventListener("focus", markRead)
    return () => window.removeEventListener("focus", markRead)
  }, [conversationId, lastSeq])
}
