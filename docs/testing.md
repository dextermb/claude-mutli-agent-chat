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

| Seam                             | Test file                        |
| -------------------------------- | -------------------------------- |
| `fileToRoutePath()`, file to URL | `src/router/file-routes.test.ts` |
| `<App />` rendered at a URL      | `src/App.test.tsx`               |
| `decodeLine()`, a stdout line    | `server/protocol/decode.test.ts` |
| `encode…()`, a stdin line        | `server/protocol/encode.test.ts` |

The server tests read the recorded fixtures through `server/test/fixtures.ts`.
An expected value comes from a recorded line, so a test shows what Claude Code
really sent or accepted. See `docs/protocol.md`.

To render the app at a URL, the `App` tests call
`window.history.pushState()` before `render(<App />)`. The pages load lazily,
so use a `findBy…` query for the first element on a page.

The way to write a test is in `.claude/rules/test-driven-development.md`.
