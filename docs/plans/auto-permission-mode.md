# The auto, dontAsk and manual permission modes

**Status:** in progress. The user approved the plan. All questions are resolved.

## The facts

Claude Code 2.1.311 gives these choices for `--permission-mode`:
`acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`. It
also accepts `default` (a hidden name). The agent form
(`MODES` in `src/pages/agents/[id].tsx`) gives only `default`,
`acceptEdits`, `plan` and `bypassPermissions`.

The server sends the mode as a free string
(`server/session/claude-args.ts`), and the Zod schema accepts any text that
is not empty. So only the form needs the new choice.

## Unknown: how `auto` works with `--permission-prompt-tool stdio`

In `auto` mode, a classifier decides each tool call. We do not know what the
stream does when the classifier refuses a call:

- Does Claude Code send a `can_use_tool` request, so the approval card
  shows in the chat?
- Or does it deny the call, with a `tool_result` that has `is_error: true`?
- Does `auto` work with each model of `MODELS`, or does it fall back?

## Decisions

1. **Measure first.** Record a fixture `auto-mode.jsonl` with
   `pnpm fixtures:record`: one safe call (`ls`) and one risky call (a
   `rm -rf` of a temporary folder), in `auto` and in `dontAsk`. Also check
   that `manual` gives a `can_use_tool` request, the same as `default`. Add
   the result as new findings in `docs/protocol.md`, from F65. This run uses
   the real `claude` and costs about 0.05 USD.
2. **Add `auto`, `dontAsk` and `manual` to `MODES`,** each with a note in
   `MODE_NOTES` that tells the truth from step 1. A draft of the note of
   `auto`: "auto lets a classifier approve each tool outside the allowed
   list. A tool that the classifier refuses
   waits for approval in the chat." The second sentence changes if the probe
   shows a deny. The note of `dontAsk` says that a tool outside the allowed
   list does not run, and that no approval card shows.
3. **If the probe shows that a refused call has no approval card**, the
   timeline must show the denial. The tool-call line already shows an error
   result, so check that the line is clear enough.

## Resolved

- **Q1. Also add `dontAsk` and `manual`?** Yes, all three.
- **Q2. What happens to `default`?** `manual` and `default` are one mode with
  two names. The form shows `manual` and not `default`. A new agent starts
  with `manual`. A saved agent with `default` shows `manual` in the form, and
  keeps `default` in the database until the user saves it. The CLI accepts
  both names, so no migration is necessary.

## The build

1. The probe and the findings (decision 1).
2. Test-first in `src/pages/agents/[id].test.tsx`:
   - The user can pick `auto`, `dontAsk` and `manual`, and the note follows
     the mode.
   - The command preview shows `--permission-mode auto`.
   - A saved agent with `default` shows `manual` (Q2).
   - A saved agent with `auto` sends `permissionMode: "auto"`.
3. Update `docs/agents.md` and `docs/forms.md` where they list the modes.
4. Run `pnpm test`, `pnpm lint` and `pnpm build`. Start an agent in `auto`
   mode in the running app, and check one safe call and one risky call.
