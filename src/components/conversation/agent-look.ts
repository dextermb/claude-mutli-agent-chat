import type { SessionState } from "@/lib/agent-api"

const INITIALS = "font-mono font-medium text-primary-foreground"

export const AVATAR_COLOURS: Record<string, string> = {
  orange: `bg-agent-orange ${INITIALS}`,
  yellow: `bg-agent-yellow ${INITIALS}`,
  green: `bg-agent-green ${INITIALS}`,
  aqua: `bg-agent-aqua ${INITIALS}`,
  blue: `bg-agent-blue ${INITIALS}`,
  purple: `bg-agent-purple ${INITIALS}`,
}

export const HUMAN_AVATAR = "bg-human font-semibold text-foreground-strong"

const STATUS: Record<
  SessionState,
  { label: string; dot: string; text: string }
> = {
  starting: {
    label: "Starting",
    dot: "bg-status-working",
    text: "text-status-working",
  },
  idle: { label: "Idle", dot: "bg-status-online", text: "text-status-online" },
  busy: {
    label: "Working",
    dot: "animate-pulse bg-status-working motion-reduce:animate-none",
    text: "text-status-working",
  },
  waiting: {
    label: "Needs approval",
    dot: "bg-status-waiting",
    text: "text-status-waiting",
  },
  failed: {
    label: "Error",
    dot: "bg-status-error",
    text: "bg-error-soft text-foreground",
  },
  exited: {
    label: "Stopped",
    dot: "bg-status-idle",
    text: "text-muted-foreground",
  },
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
