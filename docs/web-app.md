# The web app

The web app shows the agents, a DM with each agent, and the configuration of
each agent. It reads and writes through the agent server (`docs/server.md`).

## Run it

Start the agent server and the Vite dev server with one command:

```sh
pnpm dev
```

`pnpm dev` runs `concurrently "pnpm:dev:*"`, so it starts each script whose
name starts with `dev:`, and marks each output line with the name of its
script. When one script stops, `-k` stops the others. To run one alone:

```sh
pnpm dev:server   # the agent server on 127.0.0.1:4100
pnpm dev:web      # the web app; Vite sends /api to port 4100
```

## Pages

| URL                  | File                               | Shows                                             |
| -------------------- | ---------------------------------- | ------------------------------------------------- |
| `/`                  | `src/pages/index.tsx`              | The agents, with Message, Configure and New agent |
| `/agents/new`        | `src/pages/agents/[id].tsx`        | The form for a new agent                          |
| `/agents/:id`        | `src/pages/agents/[id].tsx`        | The form for a saved agent                        |
| `/conversations/:id` | `src/pages/conversations/[id].tsx` | The DM with an agent                              |

The home page reads the agents from `useWorkspace()`, so the status of each
agent follows the app stream. It shows a search by name, a line that counts
the agents by status ("5 agents · 1 working · 1 error"), and for each agent
its status dot, its status Badge, Message and Configure. With no agents, it
shows "There are no agents." and New agent.

Message on the home page opens the DM with that agent. The server gives back
the same DM each time, so an agent has one DM.

## Types

`src/lib/agent-api.ts` holds the types that the browser and the server share.
It imports them with `import type` from `server/api-types.ts` and
`server/timeline/reduce.ts`. Those two files import no Node module, so the
type check of the app does not need the Node types.

## The detail

| Page                            | Open it for                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/web-app/conversation.md`  | `useConversation()`, the parts of the timeline, the status words, a refused action, and the `@` list |
| `docs/web-app/session-panel.md` | The session panel, the members of a channel, Stop turn, New session, Remove, and the DM tabs         |
| `docs/web-app/sidebar.md`       | The sidebar, `useWorkspace()`, and the dialogs Start a chat, Create a channel and Members            |
| `docs/web-app/agent-page.md`    | The form for a new or a saved agent                                                                  |
| `docs/web-app/files.md`         | Attach, drop and `@` files, the chips, and the shared files in the thread and the panel              |
