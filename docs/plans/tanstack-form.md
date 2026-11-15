# TanStack Form with one shared Zod schema

**Status:** awaiting go-ahead. The user asked on 2026-11-15 to move the
agent page and the Create a channel dialog to TanStack Form, with checks in
the browser and on the server. The user decided two things on 2026-11-15:
Zod, and one schema that the browser and the server share. Nothing below is
built. The open questions are at the end (T1 to T4).

## Scope

Two forms change. The other forms stay as they are.

| Form                                                          | Now                                  | After                          |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------------ |
| The agent page (`src/pages/agents/[id].tsx`)                  | `useState` draft, server checks only | TanStack Form, `agentSchema`   |
| Create a channel (`src/components/create-channel-dialog.tsx`) | `useState` draft, server checks only | TanStack Form, `channelSchema` |
| The composer                                                  | One textarea                         | No change                      |
| Start a chat, Add agents                                      | Pickers, not forms                   | No change                      |

## Facts from the reading

- `zod` is 4.6.7 and `@tanstack/react-form` is 1.33.5 (`pnpm view`, on
  2026-11-15). TanStack Form 1.x has React 19 as a peer.
- Zod 4 implements Standard Schema, and TanStack Form 1.x takes a Standard
  Schema as a validator. This is from their documentation, not measured
  here. Slice 3 measures it (see T1).
- `FieldError` of shadcn (`src/components/ui/field.tsx`) takes
  `errors: { message?: string }[]`. A Standard Schema issue has that shape.
- The server checks an agent in `toNewAgent()` and `emptyFields()`
  (`server/http/server.ts`). It answers `400` with one sentence, for
  example "These fields are empty: name, cwd, model." Two tests read that
  sentence: `server/http/server.test.ts` and `src/pages/agents/[id].test.tsx`.
- The server checks a channel inline in `POST /api/conversations`: a name
  that is not empty, the pattern `^[a-z0-9-]+$`, and a name that is not
  taken (`409`). Only the last needs the database.
- `PATCH /api/agents/:id` merges the body into the stored agent, then checks
  the whole agent.

## Decisions

**One file, `server/schemas.ts`, holds `agentSchema` and `channelSchema`.**
It imports only `zod`, so the type check of the app still needs no Node
types. `server/api-types.ts` keeps the types, and derives `NewAgent` from
the schema with `z.infer` and a type-only import. The app imports the
schema values from `server/schemas.ts`. Rejected: the schemas in
`server/api-types.ts`, because that file then holds runtime code, and every
type import of it would load Zod.

**The schema holds every rule that needs no database.** The channel name
that is taken stays a check in the route, with `409`.

**The server answers a refused body with one summary and one message for
each field:**

```json
{
  "error": "Give the agent a name. Give the folder of the agent.",
  "fields": {
    "name": "Give the agent a name.",
    "cwd": "Give the folder of the agent."
  }
}
```

`error` stays, so the alert of each form keeps working. `fields` is new.
The summary is the field messages in the order of the schema. The two tests
that read "These fields are empty: …" change to the new text.

**The messages, in the schema:**

| Schema  | Field            | Rule                   | Message                                                            |
| ------- | ---------------- | ---------------------- | ------------------------------------------------------------------ |
| agent   | `name`           | not empty after a trim | Give the agent a name.                                             |
| agent   | `cwd`            | not empty after a trim | Give the folder of the agent.                                      |
| agent   | `model`          | not empty              | Pick a model.                                                      |
| agent   | `permissionMode` | not empty              | Pick a permission mode.                                            |
| agent   | `systemPrompt`   | `""` becomes `null`    |                                                                    |
| channel | `name`           | not empty after a trim | Give the channel a name.                                           |
| channel | `name`           | `^[a-z0-9-]+$`         | Use only lowercase letters, numbers and hyphens in a channel name. |
| channel | `topic`          | `""` becomes `null`    |                                                                    |
| channel | `replyMode`      | `mention` or `every`   | Pick a reply mode.                                                 |

The model and the mode stay free strings, as now. The form offers a list,
but the server does not limit the models, because new models come out.

**When a field shows its error:** after the user leaves the field, and for
each field after a submit. Not on each key, so an empty form does not open
with a list of errors. The Save button stays active, so a submit shows each
error at once. A form with an error sends no request.

**The new packages:** `zod` and `@tanstack/react-form`, at the versions
above, with `pnpm add`.

## Data flow

```
agentSchema (server/schemas.ts)
   │                                   │
   ▼ browser                           ▼ server
useForm({ validators: {             POST /api/agents, PATCH /api/agents/:id
  onBlur: agentSchema,                 agentSchema.safeParse(body)
  onSubmit: agentSchema } })             ├─ fail → 400 { error, fields }
   │  fail → FieldError under            └─ pass → store.createAgent(data)
   │         each field, no request
   ▼ pass
fetch → 400? → the alert shows `error`, and each field shows its
               message from `fields`
```

The server message reaches the field too, so a rule that only the server
knows (the taken channel name) can show under its field. See T3.

## Workflows

- **New agent.** The user leaves Name empty and goes to the next field.
  "Give the agent a name." shows under Name. The user clicks Save agent.
  Each empty field shows its message, and no request goes out.
- **Saved agent.** The form loads the agent, then behaves the same. A change
  that the schema refuses sends no `PATCH`.
- **Create a channel.** The user types "Release Train". After the field, the
  pattern message shows. Create channel sends nothing. A name that is taken
  comes back as `409`, and the alert shows it, as now.

## The build

Each slice is test-first, with one test that fails before its code.

1. **The packages and the agent schema on the server.** `pnpm add zod
@tanstack/react-form`. Write `server/schemas.ts` with `agentSchema`.
   `POST` and `PATCH /api/agents` use it in place of `toNewAgent()` and
   `emptyFields()`, which go.
2. **The channel schema on the server.** `POST /api/conversations` with
   `kind: "channel"` uses `channelSchema`. The `409` check stays.
3. **The agent page on TanStack Form.** Each field becomes a
   `form.Field`. The first test measures T1: does a form-level Standard
   Schema reach `field.state.meta.errors`? If not, each field gets its own
   validator from `agentSchema.shape.<field>`.
4. **The server message under its field.** A `400` with `fields` puts each
   message under its field.
5. **Create a channel on TanStack Form**, the same way.
6. **The docs.** `docs/web-app.md` (forms), `docs/server.md` (the `400`
   shape), a new `docs/forms.md` if `docs/web-app.md` passes 250 lines. It
   has 233 lines now.

## Seams

| Seam                           | Test file                                           | What the tests show                                                                                                         |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `createServer()`, HTTP         | `server/http/server.test.ts`, `group-chats.test.ts` | A refused agent or channel gives `400 { error, fields }` with the messages of the table                                     |
| The agent page, fake network   | `src/pages/agents/[id].test.tsx`                    | A field shows its message after a blur. A submit with errors sends nothing. A server `fields` message shows under its field |
| Create a channel, fake network | `src/components/create-channel-dialog.test.tsx`     | The pattern message after a blur. A submit with errors sends nothing                                                        |

No test reads `agentSchema` directly. The schema is the inside of two
seams that the tests already cover. The present tests of both forms find
the fields by their labels, so they must stay green with no change. That is
the check that the move to TanStack Form keeps the behaviour.

## Risks

- **Bundle size.** Zod and TanStack Form go into the app bundle. The plan
  does not know their size. Slice 3 compares the build output before and
  after. If the growth is large, `zod/mini` is smaller, but it has another
  API.
- **A free string for the model.** A typo in a hand-made request still
  reaches `claude`, and the process fails. The failed notice of step 3 then
  shows the stderr.

## Open questions

- **T1.** Slice 3 measures whether a form-level schema reaches each field.
  If it does not, is a validator for each field from `agentSchema.shape`
  acceptable?
- **T2.** Are the messages of the table the words that you want?
- **T3.** Should the taken channel name show under the Name field (from
  `fields`), or only in the alert, as now?
- **T4.** Should the server limit `model` and `permissionMode` to the lists
  of the form? The plan keeps free strings.
