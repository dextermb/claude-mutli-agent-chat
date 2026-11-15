import { homedir } from "node:os"

export function homeShort(folder: string): string {
  const home = homedir()
  return folder === home || folder.startsWith(`${home}/`)
    ? `~${folder.slice(home.length)}`
    : folder
}
