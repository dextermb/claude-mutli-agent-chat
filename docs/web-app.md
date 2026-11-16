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

## The design

Two artifacts on claude.ai hold the design of the web app:

- **Boards:** the "Agent Chat" canvas, 26 boards on the "Current app" page
  and 4 on the "AI Elements" page
  (https://claude.ai/artifact/NyiP26udWrUFSDDX6BjutT).
- **Design system:** "Gruvbox Chat"
  (https://claude.ai/artifact/3cUXEWP7TNyCWaxnSe8fYu).

Read them with the Artifact tool, not with a web fetch. The app follows the
boards, but the boards show some things that the app does not build:

- **Counts on Grep and Glob** ("3 matches"). Claude Code has no Grep tool and
  no Glob tool. The agents use `grep` and `find` through Bash.
- **"Thought 4s".** Claude Code sends a `thinking` block with empty text, so
  the app has no reasoning to show.
- **Suggestions, Edit, Retry, Good response and Bad response.** Nothing makes
  the suggestions, and the server has no action for the others.
- **A model menu in the message box.** The model is part of the agent
  configuration, so the message box links to it.
- **People.** The app runs locally and has one user.
- **The rail pages Direct messages and Activity.** The sidebar lists each DM,
  and the unread counts and the footer show what is new.
- **A Run a slash command button.** A group chat or a channel wraps each
  message in a prompt (`[User] /compact`), so Claude Code never gets it as a
  command. The server sends `/compact` itself before an agent sleeps.
- **A Name field in Channel settings and Group chat settings.** The name of
  a conversation does not change after it is made (`docs/conversations.md`).

## The detail

| Page                            | Open it for                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/web-app/conversation.md`  | `useConversation()`, the parts of the timeline, the status words, a refused action, and the `@` list |
| `docs/web-app/messages.md`      | The Markdown of a message, the code blocks and their colours, and the mentions                       |
| `docs/web-app/components.md`    | The directories of `src/components` and the helpers in `src/lib`                                     |
| `docs/web-app/session-panel.md` | The session panel, the members of a channel, Stop turn, New session, Remove, and the DM tabs         |
| `docs/web-app/sidebar.md`       | The sidebar, `useWorkspace()`, and the dialogs Start a chat, Create a channel and Members            |
| `docs/web-app/agent-page.md`    | The form for a new or a saved agent                                                                  |
| `docs/web-app/files.md`         | Attach, drop and `@` files, the chips, and the shared files in the thread and the panel              |
| `docs/web-app/scroll.md`        | How the messages stick to the bottom, and the jump button                                            |
