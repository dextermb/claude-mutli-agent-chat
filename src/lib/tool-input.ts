import type { Json } from "@/lib/agent-api"

export function mainInput(name: string, input: Json, cwd: string): string {
  const value =
    input.file_path ??
    input.command ??
    input.pattern ??
    input.url ??
    input.description ??
    ""
  const text = typeof value === "string" ? value : ""
  if (name === "Bash") return text
  const prefix = cwd.endsWith("/") ? cwd : `${cwd}/`
  return text.startsWith(prefix) ? text.slice(prefix.length) : text
}
