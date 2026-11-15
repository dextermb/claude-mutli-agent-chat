import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { createServer } from "./http/server.ts"
import { AgentSession } from "./session/session.ts"
import { openStore } from "./store/store.ts"

const DATABASE = process.env.AGENTS_DATABASE ?? ".data/agents.db"
const PORT = Number(process.env.PORT ?? 4100)

mkdirSync(dirname(DATABASE), { recursive: true })
const store = openStore(DATABASE)

const server = createServer({
  store,
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
