export type Named = { name: string; displayName: string | null }

export function shownName(agent: Named): string {
  return agent.displayName ?? agent.name
}

export function slugOf(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "agent"
}
