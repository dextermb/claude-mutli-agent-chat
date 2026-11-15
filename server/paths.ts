import { homedir } from "node:os"
import { join } from "node:path"

export function defaultScratchRoot(): string {
  return (
    process.env.AGENTS_SCRATCH ??
    join(homedir(), ".local", "share", "agent-chat", "scratch")
  )
}

export function homeShort(folder: string): string {
  const home = homedir()
  return folder === home || folder.startsWith(`${home}/`)
    ? `~${folder.slice(home.length)}`
    : folder
}
