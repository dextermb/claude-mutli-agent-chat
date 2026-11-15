export function summaryOf(text: string): string {
  const line = parse(text)
  if (!line) return "not JSON"
  const type = typeof line.type === "string" ? line.type : "unknown"
  const request = line.request as Record<string, unknown> | undefined
  const event = line.event as Record<string, unknown> | undefined
  if (type === "control_request" && request) {
    return `control_request ${String(request.subtype)}`
  }
  if (type === "stream_event" && event) {
    return `stream_event ${String(event.type)}`
  }
  return typeof line.subtype === "string" ? `${type}/${line.subtype}` : type
}

export function prettyLine(text: string): string {
  const line = parse(text)
  return line ? JSON.stringify(line, null, 2) : text
}

function parse(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
