# Project

A Vite single-page app with React 19, TypeScript, Tailwind CSS v4, and
shadcn/ui on Base UI (`components.json`: style `base-nova`). The package
manager is pnpm.

## Commands

| Command          | Result                              |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Starts the dev server.              |
| `pnpm test`      | Runs the Vitest tests.              |
| `pnpm typecheck` | Checks the types.                   |
| `pnpm lint`      | Runs ESLint.                        |
| `pnpm build`     | Checks the types and builds `dist`. |

## Where things are

- `src/pages`: one file for each page. See `docs/routing.md`.
- `src/router`: the file-based router.
- `src/components/ui`: shadcn components. Add them with
  `pnpm dlx shadcn@latest add <name>`. Do not write them by hand.
- `docs/testing.md`: the test set-up and the seams under test.
- `docs/protocol.md`: the Claude Code stream that the server reads, and its
  fixtures in `server/protocol/fixtures`. Record them again with
  `pnpm fixtures:record`.
- `docs/timeline.md`: how the server turns the stream into timeline items.

## Rules

- Plan and build each change in its own worktree, then collapse it into
  `master`. See `.claude/rules/worktrees.md`.
- Build features and fix bugs test-first with the `tdd` skill. See
  `.claude/rules/test-driven-development.md`.
- shadcn on Base UI uses the `render` prop, not `asChild`.
