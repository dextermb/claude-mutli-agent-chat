# Forms

Two forms check their input before they send it: the agent page
(`src/pages/agents/[id].tsx`) and the Create a channel dialog
(`src/components/dialogs/create-channel-dialog.tsx`). Both use TanStack Form, and
both check their values with the same Zod schema as the server. The Channel
settings dialog sends input too, but only the server checks it (see "One
schema").

## The layout of a form

A form on a page uses one column of sections, as the agent page does. A form
in a dialog keeps the layout of the dialog. The design is the boards "A: new
agent" and "A: edit test-runner" on the "Agent form options" page of the Agent
Chat canvas (`docs/web-app.md`).

- `SettingsSection` (`src/components/forms/settings-section.tsx`): the title
  and one line at the left, the fields at the right. They stack at a narrow
  width. A section with an unsaved change shows a "Changed" badge.
- `OnThisPage` (`src/components/forms/on-this-page.tsx`): a link to each
  section, with a dot for a changed section. It shows from the `lg` width.
- `FormBar` (`src/components/forms/form-bar.tsx`): a bar at the foot of the
  form, with a status and the actions. The status counts the unsaved changes
  (`src/lib/changed-fields.ts`), or names the fields to fix after a submit
  (`fixText` in `src/lib/form-errors.ts`).
- A choice that needs an explanation is a radio group of cards, with the note
  on each card, as the permission mode.

## Pending buttons and toasts

While its request runs, a button shows a Spinner, says what it does
("Saving…"), and is disabled. Then a toast gives the result, through
`src/lib/toasts.ts`:

- `toastDone(title)`: a success toast. It closes after 5 seconds.
- `toastRefusal(title, reason)`: an error toast with the reason of the
  server. It stays until the user closes it, because the user must read the
  reason. A message for a field still shows under its field.

The `<Toaster>` of `src/components/ui/toast.tsx` is around the app in
`src/App.tsx`. Today the agent page and its Stop agent and Restart session
use them. The dialogs still show a refusal in an alert in the dialog.

## One schema

`server/schemas.ts` holds `agentSchema` and `channelSchema`. It imports only
`zod`, so the app can import it and still needs no Node types.

- The server checks each body with `checkBody(schema, body)`, in
  `POST /api/agents`, `PATCH /api/agents/:id` (on the stored agent with the
  body merged in), `POST /api/conversations` for a channel, and
  `PATCH /api/conversations/:id` with `channelSettingsSchema`, the topic,
  `private`, `replyMode`, `cwd` and `sleepAfterMinutes` of `channelSchema`
  (on the stored channel with the body merged in).
- The browser gives the same schema to `useForm()` as its `onBlur` and
  `onSubmit` validator.
- `NewAgent` in `server/api-types.ts` is the output type of `agentSchema`.

The Channel settings dialog
(`src/components/dialogs/channel-settings/channel-settings-dialog.tsx`) is not a TanStack Form. Its
fields are a text, a folder, a switch, a radio and a number. Only a sleep
time out of range fails the schema. That, and a folder that does not exist,
get `400` from the route. It keeps its values in state, and shows a refusal
of the server in an alert.

A rule that needs the database stays in the route. A channel name that is
taken gives `409`, and the dialog shows it in its alert only.

| Field                   | Rule                                 | Message                                                                              |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| agent `name`            | not empty after a trim               | Give the agent a name.                                                               |
| agent `model`           | not empty                            | Pick a model.                                                                        |
| agent `permissionMode`  | not empty                            | Pick a permission mode.                                                              |
| agent `maxTurns`        | a whole number, 1 or more, or `null` | Give a whole number of 1 or more, or leave it empty.                                 |
| `sleepAfterMinutes`     | a whole number, 0 to 55, or empty    | Give a whole number from 0 to 55, or leave it empty.                                 |
| agent `disallowedTools` | no entry `ToolSearch` (F56)          | Do not block ToolSearch. Without it, each request loads the schema of each MCP tool. |
| channel `name`          | not empty after a trim               | Give the channel a name.                                                             |
| channel `name`          | `^[a-z0-9-]+$`                       | Use only lowercase letters, numbers and hyphens in a channel name.                   |
| channel `replyMode`     | `mention` or `every`                 | Pick a reply mode.                                                                   |

The model and the permission mode are free strings, because new models and
modes come out. A stored mode that the form does not list, such as `default`,
stays valid (`docs/agents.md`). The schema gives a default to the fields that
an older client can leave out (the colour, the lists, `autostart`, `private`,
`replyMode`), and turns an empty system prompt, description, topic or `cwd`
into `null`. An agent and a channel can both have no folder
(`docs/agents.md`). The route checks that the folder of a channel exists,
because the browser cannot.

## A refused body

The server answers `400` with a summary and one message for each field:

```json
{
  "error": "Give the agent a name. Pick a model.",
  "fields": {
    "name": "Give the agent a name.",
    "model": "Pick a model."
  }
}
```

The summary is the field messages in the order of the schema.

## When a field shows an error

- After the user leaves the field, and for each field after a submit. Not on
  each key.
- A form with an error sends no request.
- The agent page puts each message of `fields` under its field, as an
  `onServer` error. A change to the field clears it (a form-level
  `onChange` listener), else the field stays invalid and no later submit
  would send.
- `src/lib/form-errors.ts` decides what a field shows. A schema error is an
  object with a `message`, and a server error is a string.

## The type of the form values

TanStack Form takes a Standard Schema only when the input type of the schema
fits the type of the form values. The defaults and the `null` values of the
schemas make some input fields optional, so each form types its values from
the schema: `AgentDraft` and `ChannelDraft` (`z.input`). A form field that can
be `undefined` gives a fallback, for example `field.state.value ?? []`.

## Bundle size

Measured with `pnpm build` on 2026-11-15. Zod and TanStack Form load only
with the agent page and the channel dialog. The agent page chunk grew from
7.38 kB (2.73 kB gzip) to 151.75 kB (41.26 kB gzip). The main chunk did not
change. `zod/mini` is smaller, but it has another API.
