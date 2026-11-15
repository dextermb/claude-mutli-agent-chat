import { useEffect, useState } from "react"

import type { LogLine, StreamMessage } from "@/lib/agent-api"

const PAGE = 200

export function useSessionLog(conversationId: string, agentId: string) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [more, setMore] = useState(false)
  const route = `/api/conversations/${conversationId}/agents/${agentId}/log`

  useEffect(() => {
    let current = true
    const source = new EventSource(
      `/api/conversations/${conversationId}/events`
    )
    source.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as StreamMessage
      if (message.type !== "line" || message.agentId !== agentId) return
      setLines((lines) => merge(lines, [message.line]))
    }
    fetch(route)
      .then((response) => response.json() as Promise<{ lines: LogLine[] }>)
      .then((page) => {
        if (!current) return
        setLines((lines) => merge(page.lines, lines))
        setMore(page.lines.length === PAGE)
      })
      .catch(() => undefined)
    return () => {
      current = false
      source.close()
    }
  }, [conversationId, agentId, route])

  async function loadEarlier() {
    const before = lines[0]?.seq
    if (before === undefined) return
    const response = await fetch(`${route}?before=${before}`)
    const page = (await response.json()) as { lines: LogLine[] }
    setLines((lines) => merge(page.lines, lines))
    setMore(page.lines.length === PAGE)
  }

  return { lines, more, loadEarlier }
}

function merge(first: LogLine[], second: LogLine[]): LogLine[] {
  const bySeq = new Map<number, LogLine>()
  for (const line of [...first, ...second]) bySeq.set(line.seq, line)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}
