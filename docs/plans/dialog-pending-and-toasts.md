# Pending buttons and toasts in the dialogs

**Status:** awaiting go-ahead. The agent page is built: its layout, its
pending buttons and its toasts are in `docs/forms.md` and
`docs/web-app/agent-page.md`. This plan holds only the work that is still
ahead.

The user asked on 2026-11-17 for a pending state on each button and a toast
when an action works or fails. The agent page has them. The dialogs do not.

## What is ahead

Do this in its own worktree. It uses the `<Toaster>`, `toastDone` and
`toastRefusal` that are on `master` now.

| Where                       | The action today                          | The change                                      |
| --------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Create a channel            | Create, refusal in an alert in the dialog | "Creating…", then "#name is created."           |
| Channel settings            | Save, refusal in an alert                 | "Saving…", then "#name is saved."               |
| Group chat settings         | Save                                      | "Saving…", then a success toast                 |
| Start a chat                | Start                                     | "Starting…", then a success toast               |
| Members (Add members)       | Add                                       | "Adding…", then a success toast                 |
| Delete dialog (each delete) | Spinner, refusal in an alert              | A success toast: "test-runner is deleted."      |
| Session panel actions       | Stop turn, New session, Remove            | The same pending state and toasts as Stop agent |

## Open questions

1. A refusal in a dialog: keep the alert in the dialog, or use an error
   toast? The dialog stays open after a refusal, so the alert is next to the
   fields. The proposal is to keep the alert in a dialog, and to use a toast
   only for success.
2. The session panel actions (`src/components/conversation/session/`) use
   their own `refusal-of.tsx`. Do they belong in this change, or in a third?
