# Testing

The project uses [Vitest](https://vitest.dev) with jsdom and
[Testing Library](https://testing-library.com).

| Command           | Result                          |
| ----------------- | ------------------------------- |
| `pnpm test`       | Runs all the tests one time.    |
| `pnpm test:watch` | Runs the tests on each change.  |

## Set-up

- `vite.config.ts` holds the `test` settings, so the tests use the same
  `@/` alias and plugins as the app.
- `src/test/setup.ts` loads the `jest-dom` matchers and removes the rendered
  DOM after each test.

## The seams under test

| Seam                                 | Test file                        |
| ------------------------------------ | -------------------------------- |
| `fileToRoutePath()`, file to URL     | `src/router/file-routes.test.ts` |
| `<App />` rendered at a URL          | `src/App.test.tsx`               |

To render the app at a URL, the `App` tests call
`window.history.pushState()` before `render(<App />)`. The pages load lazily,
so use a `findBy…` query for the first element on a page.

The way to write a test is in `.claude/rules/test-driven-development.md`.
