# Testing

The project uses [Vitest](https://vitest.dev) with jsdom and
[Testing Library](https://testing-library.com).

| Command           | Result                         |
| ----------------- | ------------------------------ |
| `pnpm test`       | Runs all the tests one time.   |
| `pnpm test:watch` | Runs the tests on each change. |

## Set-up

- `vite.config.ts` holds the `test` settings, so the tests use the same
  `@/` alias and plugins as the app. It has two projects:
  - `app`: the files `src/**/*.test.{ts,tsx}`, in jsdom.
  - `server`: the files `server/**/*.test.ts`, in Node.
- Run one project with `pnpm test --project server`.
- `src/test/setup.ts` loads the `jest-dom` matchers and removes the rendered
  DOM after each test.

## The seams under test

| Seam                              | Test file                               |
| --------------------------------- | --------------------------------------- |
| `fileToRoutePath()`, file to URL  | `src/router/file-routes.test.ts`        |
| `<App />` rendered at a URL       | `src/App.test.tsx`                      |
| `decodeLine()`, a stdout line     | `server/protocol/decode.test.ts`        |
| `encode…()`, a stdin line         | `server/protocol/encode.test.ts`        |
| `reduceTimeline()`, a fixture     | `server/timeline/reduce.test.ts`        |
| `buildArgs()`, the command line   | `server/session/args.test.ts`           |
| `AgentSession`, a fake `claude`   | `server/session/session.test.ts`        |
| `Store`, an in-memory database    | `server/store/store.test.ts`            |
| `createServer()`, HTTP and SSE    | `server/http/server.test.ts`            |
| `useConversation()`, fake network | `src/hooks/use-conversation.test.ts`    |
| The DM page, fake network         | `src/pages/conversations/[id].test.tsx` |
| The agent page, fake network      | `src/pages/agents/[id].test.tsx`        |

The server tests read the recorded fixtures through `server/test/fixtures.ts`.
An expected value comes from a recorded line, so a test shows what Claude Code
really sent or accepted. See `docs/protocol.md`.

The `AgentSession` tests start `server/test/fake-claude.ts`, which plays a
fixture as a `claude` process. See `docs/agents.md`.

The `createServer()` tests listen on a free port and send real requests with
`fetch`. Their `startSession` starts the fake `claude` and keeps each line
that goes to it, so a test can check the answers that reach Claude Code.

The browser tests use `src/test/fake-network.ts`. It replaces `fetch` and
`EventSource`, keeps each request that the page sends, and lets a test send
stream events. `src/test/conversation-data.ts` holds the conversation, the
agent and the timeline entries that the tests show.

`server/http/live.test.ts` runs the real `claude` with Haiku. It runs only
with `pnpm test:live` (`CLAUDE_LIVE=1`), because each run costs about
0.01 USD.

The `Store` tests use `:memory:`. A test of a server start uses a database
file in a temporary folder, and opens the store a second time.

To render the app at a URL, the `App` tests call
`window.history.pushState()` before `render(<App />)`. The pages load lazily,
so use a `findBy…` query for the first element on a page.

The way to write a test is in `.claude/rules/test-driven-development.md`.
