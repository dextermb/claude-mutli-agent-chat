import type { SessionCard } from "@/lib/agent-api"

type Context = NonNullable<SessionCard["context"]>

export function contextPercent(context: Context): number {
  return Math.round((context.used / context.window) * 100)
}

export function contextTokens(context: Context): string {
  const count = (value: number) => value.toLocaleString("en-GB")
  return `${count(context.used)} / ${count(context.window)}`
}
