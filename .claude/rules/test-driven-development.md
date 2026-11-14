# Test-Driven Development

Build each feature and fix each bug test-first. Before you write the code,
invoke the `tdd` skill with the Skill tool. Then follow it.

These requests trigger the skill:

- "add a feature", "build", "implement", or "make it do X",
- "fix this bug", "this is broken", or "this gives the wrong value",
- "red-green-refactor", "test-first", or "TDD".

The `tdd` skill uses the vocabulary of the `codebase-design` skill. Both
skills live in the user scope (`~/.claude/skills`).

# The loop

1. Agree the seams with the user before you write a test file. A seam is a
   public boundary that a test can observe from the outside: a page, a
   component, a hook, or an exported function.
2. Write one test that fails. Run `pnpm test` and see it fail for the
   correct reason.
3. Write only enough code to make that test pass. Run `pnpm test` again.
4. Go back to step 2 for the next behaviour. Do one vertical slice at a
   time. Do not write a batch of tests before the code.

# Good tests

- Name a test for a capability: "user can increase the count", not
  "setCount is called".
- Get the expected value from a literal, a worked example, or the spec.
  Do not calculate it the same way that the code does.
- Query the DOM the way a user sees it: `getByRole`, `getByLabelText`.
- Use `@testing-library/user-event` for interaction, not `fireEvent`.
- Use a mock only at a system boundary: the network, the clock, or random
  values. Do not mock the modules of this project.
- A rename with no change in behaviour must not break a test.

# When the loop does not apply

Configuration, wiring, glue code, and changes to style only have no good
seam. For these, make the change and run `pnpm test`, `pnpm typecheck`, and
`pnpm lint`. Write browser (end-to-end) tests after the behaviour works,
not before.

# Where tests go

Put a test next to the file that it tests, with the name `<name>.test.ts`
or `<name>.test.tsx`. Vitest runs in jsdom. The file `src/test/setup.ts`
loads the `jest-dom` matchers.
