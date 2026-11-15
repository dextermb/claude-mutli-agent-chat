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
- `src/test/setup.ts` loads the `jest-dom` matchers. Before each test, it
  sets a screen 1280 px wide and a window without the focus. After each
  test, it removes the rendered DOM, then the stubbed globals and the spies.
  So a test file does not call `vi.unstubAllGlobals()` or
  `vi.restoreAllMocks()` itself.
- `src/test/fake-screen.ts` holds the screen of the user:
  - jsdom has no `matchMedia`. `screenWidth(width)` stubs it, and answers
    each `(max-width: …px)` query for that width. A test calls
    `screenWidth(375)` to show the page on a phone.
  - `windowFocus(focused)` sets what `document.hasFocus()` answers. A test
    of a read calls `windowFocus(true)`.

## The seams under test

| Seam                              | Test file                                       |
| --------------------------------- | ----------------------------------------------- |
| `fileToRoutePath()`, file to URL  | `src/router/file-routes.test.ts`                |
| `<App />` rendered at a URL       | `src/App.test.tsx`                              |
| `decodeLine()`, a stdout line     | `server/protocol/decode.test.ts`                |
| `encode…()`, a stdin line         | `server/protocol/encode.test.ts`                |
| `reduceTimeline()`, a fixture     | `server/timeline/reduce.test.ts`                |
| `buildArgs()`, the command line   | `server/session/args.test.ts`                   |
| `environmentPrompt()`, the rule   | `server/session/environment-prompt.test.ts`     |
| `AgentSession`, a fake `claude`   | `server/session/session.test.ts`                |
| `Store`, an in-memory database    | `server/store/store.test.ts`                    |
| `createServer()`, HTTP and SSE    | `server/http/server.test.ts`                    |
| `POST /mcp`, the chat tools       | `server/http/mcp.test.ts`                       |
| `useConversation()`, fake network | `src/hooks/use-conversation.test.ts`            |
| `useWorkspace()`, fake network    | `src/hooks/use-workspace.test.ts`               |
| `filesOf()`, the Files tab rows   | `src/lib/files.test.ts`                         |
| The DM page, fake network         | `src/pages/conversations/[id].test.tsx`         |
| `Composer`, the mention list      | `src/components/conversation/composer.test.tsx` |
| The Start a chat dialog           | `src/components/start-chat-dialog.test.tsx`     |
| The Create a channel dialog       | `src/components/create-channel-dialog.test.tsx` |
| The agent page, fake network      | `src/pages/agents/[id].test.tsx`                |

The server tests read the recorded fixtures through `server/test/fixtures.ts`.
An expected value comes from a recorded line, so a test shows what Claude Code
really sent or accepted. See `docs/protocol.md`.

The `AgentSession` tests start `server/test/fake-claude.ts`, which plays a
fixture as a `claude` process. See `docs/agents.md`.

The `createServer()` tests listen on a free port and send real requests with
`fetch`. `server/test/http.ts` holds their helpers. Its `startSession` starts
the fake `claude` and keeps each line that goes to each agent, so a test can
check the answers and the prompts that reach Claude Code. `callChat(args,
method, params)` calls the `chat` MCP server with the address and the token
from the `--mcp-config` of a started process. A test can give
each agent its own fixture, and its own reply text with `FAKE_CLAUDE_REPLY`.

The browser tests use `src/test/fake-network.ts`. It replaces `fetch` and
`EventSource`, keeps each request that the page sends, and lets a test send
stream events. A page opens two streams, so `network.stream(address)` finds
the last stream whose address starts with `address`.
`network.fail(method, url)` makes `fetch` reject for that request, as it does
when the server is down.
`src/test/conversation-data.ts` holds the conversation, the
agent and the timeline entries that the tests show.

`server/http/live.test.ts` runs the real `claude` with Haiku. It runs only
with `pnpm test:live` (`CLAUDE_LIVE=1`), because each run costs money: about
0.005 USD for the DM test, about 0.013 USD for the test of New session and
`--resume`, about 0.005 USD for the test of the rule of the environment, and
about 0.01 USD for the test of a chat tool (five turns in all, about
0.035 USD).

The test of a chat tool finds the tool call by its name, not as the first
tool call. In one full run on 2026-11-15, it failed at the first tool call,
and it then passed in three runs. The cause is not known.

The `Store` tests use `:memory:`. A test of a server start uses a database
file in a temporary folder, and opens the store a second time.

To render the app at a URL, the `App` tests call
`window.history.pushState()` before `render(<App />)`. The pages load lazily,
so use a `findBy…` query for the first element on a page.

The way to write a test is in `.claude/rules/test-driven-development.md`.

## A flaky test

The server test "the user can allow once, deny, or always allow a tool, and
each card shows the answer" failed one time in a full run on 2026-11-15. It
then passed in more than ten full runs, and its error was not kept. If it
fails again, keep the output of the run, and use the `diagnosing-bugs`
skill.
