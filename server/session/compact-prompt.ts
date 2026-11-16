import { readFileSync } from "node:fs"

export const COMPACT_PROMPT = `/compact ${readFileSync(
  new URL("../../agent/compact.md", import.meta.url),
  "utf8"
)
  .trim()
  .replace(/\s+/g, " ")}`
