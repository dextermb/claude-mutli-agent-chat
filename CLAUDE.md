# Project

A Vite single-page app with React 19, TypeScript, Tailwind CSS v4, and
shadcn/ui on Base UI (`components.json`: style `base-nova`). The package
manager is pnpm.

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

## Where things are

- `src/pages`: one file for each page. See `docs/routing.md`.
- `src/router`: the file-based router.
- `src/components/ui`: shadcn components. Add them with
  `pnpm dlx shadcn@latest add <name>`. Do not write them by hand.
- `docs/README.md`: the index of the documentation. Add each new page to it.
- `docs/architecture.md`: the parts of the agent app, and why.
- `docs/testing.md`: the test set-up and the seams under test.
- `docs/protocol.md`: the Claude Code stream that the server reads, and its
  fixtures in `server/protocol/fixtures`. Record them again with
  `pnpm fixtures:record`.
- `docs/timeline.md`: how the server turns the stream into timeline items.
- `docs/agents.md`: the `claude` process of each agent session.
- `docs/agent-environment.md`: the rule that tells each agent about the chat
  app, and the `chat` plugin in `agent/`.
- `docs/mcp.md`: the `chat` MCP server that each agent gets, and its tools.
- `docs/store.md`: the SQLite tables and the queries.
- `docs/server.md`: the routes and the event stream of the agent server.
- `docs/conversations.md`: who gets a turn, mentions, and the prompt shape.
- `docs/sleep.md`: the sleep time of an agent, and the compaction before an
  idle process stops.
- `docs/web-app.md`: the pages of the web app. It is the index of
  `docs/web-app/`: the conversation, the session panel, the sidebar and the
  agent page.
- `docs/forms.md`: the two forms, the shared Zod schema in
  `server/schemas.ts`, and the shape of a refused body.

## Rules

- Plan and build each change in its own worktree, then collapse it into
  `master`. See `.claude/rules/worktrees.md`.
- Build features and fix bugs test-first with the `tdd` skill. See
  `.claude/rules/test-driven-development.md`.
- shadcn on Base UI uses the `render` prop, not `asChild`.
