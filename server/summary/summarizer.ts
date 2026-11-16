import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { childEnvironment } from "../session/environment.ts"

export type SummaryInput = { earlier: string | null; lines: string[] }

export type Summary = { text: string; costUsd: number }

export type Summarize = (input: SummaryInput) => Promise<Summary | null>

const SUMMARIZE_RULE = readFileSync(
  new URL("../../agent/summarize.md", import.meta.url),
  "utf8"
).trim()

const TIMEOUT_MS = 30_000

export function claudeSummarizer({
  command = "claude",
  commandArgs = [],
  cwd,
  timeoutMs = TIMEOUT_MS,
  env = process.env,
}: {
  command?: string
  commandArgs?: string[]
  cwd: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
}): Summarize {
  return (input) =>
    new Promise((resolve) => {
      const child = spawn(
        command,
        [
          ...commandArgs,
          "-p",
          "--output-format",
          "json",
          "--setting-sources",
          "project",
          "--strict-mcp-config",
          "--tools",
          "",
          "--disable-slash-commands",
          "--model",
          "haiku",
          "--no-session-persistence",
          "--system-prompt",
          SUMMARIZE_RULE,
        ],
        { cwd, env: childEnvironment(env), stdio: ["pipe", "pipe", "ignore"] }
      )
      let stdout = ""
      child.stdout.on("data", (chunk: Buffer) => (stdout += String(chunk)))
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
      child.on("error", () => {
        clearTimeout(timer)
        resolve(null)
      })
      child.on("close", (code) => {
        clearTimeout(timer)
        resolve(code === 0 ? summaryOf(stdout) : null)
      })
      child.stdin.end(summaryPrompt(input))
    })
}

function summaryPrompt({ earlier, lines }: SummaryInput): string {
  const parts = earlier ? [`Earlier summary:\n${earlier}`] : []
  parts.push(`Messages:\n${lines.join("\n")}\n`)
  return parts.join("\n\n")
}

function summaryOf(stdout: string): Summary | null {
  try {
    const result = JSON.parse(stdout) as {
      is_error?: boolean
      result?: unknown
      total_cost_usd?: unknown
    }
    if (result.is_error || typeof result.result !== "string") return null
    return {
      text: result.result.trim(),
      costUsd: Number(result.total_cost_usd ?? 0),
    }
  } catch {
    return null
  }
}
