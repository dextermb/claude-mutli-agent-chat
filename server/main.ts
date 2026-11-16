import { mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { createServer } from "./http/server.ts"
import { defaultScratchRoot } from "./paths.ts"
import { AgentSession } from "./session/session.ts"
import { openStore } from "./store/store.ts"
import { claudeSummarizer } from "./summary/summarizer.ts"

const DATABASE = process.env.AGENTS_DATABASE ?? ".data/agents.db"
const UPLOADS = resolve(
  process.env.AGENTS_UPLOADS ?? join(dirname(DATABASE), "uploads")
)
const PORT = Number(process.env.PORT ?? 4100)
const SLEEP_AFTER_MINUTES = numberOrUndefined(
  process.env.AGENTS_SLEEP_AFTER_MINUTES
)
const COMPACT_ABOVE_TOKENS = numberOrUndefined(
  process.env.AGENTS_COMPACT_ABOVE_TOKENS
)
const WAKE_MESSAGES = numberOrUndefined(process.env.AGENTS_WAKE_MESSAGES)

const SUMMARIZER_FOLDER = join(defaultScratchRoot(), "summarizer")

mkdirSync(dirname(DATABASE), { recursive: true })
mkdirSync(SUMMARIZER_FOLDER, { recursive: true })
const store = openStore(DATABASE)

const server = createServer({
  store,
  uploadsFolder: UPLOADS,
  sleepAfterMinutes: SLEEP_AFTER_MINUTES,
  compactAboveTokens: COMPACT_ABOVE_TOKENS,
  wakeMessages: WAKE_MESSAGES,
  summarize: claudeSummarizer({ cwd: SUMMARIZER_FOLDER }),
  startSession: ({ args, cwd, onEvent }) => {
    const session = new AgentSession({
      command: "claude",
      args,
      cwd,
      env: process.env,
      onEvent,
    })
    session.start()
    return session
  },
})

const address = await server.listen(PORT)
console.log(`Agent server on http://${address.host}:${address.port}`)
server.autostart()

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.close().then(() => {
      store.close()
      process.exit(0)
    })
  })
}

function numberOrUndefined(value: string | undefined): number | undefined {
  return value === undefined || value === "" ? undefined : Number(value)
}
