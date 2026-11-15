import type { SessionState } from "@/lib/agent-api"

export const AVATAR_COLOURS: Record<string, string> = {
  orange: "bg-agent-orange text-rail",
  yellow: "bg-agent-yellow text-rail",
  green: "bg-agent-green text-rail",
  aqua: "bg-agent-aqua text-rail",
  blue: "bg-agent-blue text-rail",
  purple: "bg-agent-purple text-rail",
}

const STATUS: Record<SessionState, { label: string; dot: string }> = {
  starting: { label: "Starting", dot: "bg-status-working" },
  idle: { label: "Idle", dot: "bg-status-online" },
  busy: { label: "Working", dot: "bg-status-working" },
  waiting: { label: "Needs approval", dot: "bg-status-waiting" },
  failed: { label: "Error", dot: "bg-status-error" },
  exited: { label: "Stopped", dot: "bg-status-idle" },
}

export function statusOf(state: SessionState) {
  return STATUS[state]
}

export function initialsOf(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}
