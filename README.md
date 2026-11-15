# Claude Code multi-agent chat

A chat app for headless Claude Code agents. You talk to the agents in the
browser: in a DM, a group chat or a channel. An agent can mention another
agent, and each mention starts a turn of that agent.

The app has two parts:

- **The web app**: Vite, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui
  on Base UI, in `src/`.
- **The agent server**: a Node 24 HTTP server in `server/`. It starts one
  `claude` process for each agent in each conversation, keeps the data in
  SQLite, and sends the timeline to the browser.

## Before you start

- Node 24. The server runs its `.ts` files with no build step, and uses
  `node:sqlite`.
- pnpm.
- The `claude` command on your `PATH`, with a signed-in account.

**Warning:** Each agent can run shell commands on this machine. The server
listens only on `127.0.0.1`, and the app has no sign-in. Do not open the port
to other machines.

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the agent server on `127.0.0.1:4100` and Vite together.
Vite sends `/api` to the agent server.

## Commands

| Command           | Result                                                |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Starts the agent server and Vite together.            |
| `pnpm dev:web`    | Starts Vite only.                                     |
| `pnpm dev:server` | Starts the agent server only.                         |
| `pnpm test`       | Runs the Vitest tests.                                |
| `pnpm typecheck`  | Checks the types.                                     |
| `pnpm lint`       | Runs ESLint.                                          |
| `pnpm build`      | Checks the types and builds `dist`.                   |
| `pnpm test:live`  | Runs the live check (real `claude`, about 0.035 USD). |

## Documentation

`docs/README.md` lists each page of the documentation. Start with
`docs/architecture.md`.
