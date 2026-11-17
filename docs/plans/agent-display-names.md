# Agent display names

**Status:** in progress. The user agreed the plan and the seams on 2026-11-17.

Each agent gets two names:

- a **username**, for example `foo-bar`. A person and an agent type it in an
  @mention. The prompt of an agent uses it.
- a **display name**, for example `Foo Bar`. People read it in the app.

## Decisions

1. **The username stays in the `name` field and the `name` column.** The UI
   calls it "Username". A rename of the field to `username` changes each file
   that touches an agent, and it gives no new behaviour. Rejected for now.
2. **The new field is `displayName`, column `display_name`, nullable.** An
   empty display name is `null`, and the app then shows the username. A new
   agent still needs only one field. (User answer: "Optional, falls back".)
3. **A username uses only lowercase letters, numbers and hyphens**, the rule
   of a channel name (`^[a-z0-9-]+$`). (User answer: "Slug rule + migrate".)
4. **A username is unique among the agents that are not deleted.** A taken
   username gets `409`. A deleted agent frees its username. (User answer:
   "Unique".)
5. **The migration makes a slug from each old name**, and keeps the old name
   as the display name when the two are different:

   | Old `name`    | New `name`    | New `display_name` |
   | ------------- | ------------- | ------------------ |
   | `test-runner` | `test-runner` | `null`             |
   | `Test Runner` | `test-runner` | `Test Runner`      |
   | `Ops_Bot 2`   | `ops-bot-2`   | `Ops_Bot 2`        |
   | `!!!`         | `agent`       | `!!!`              |

   A slug that a live agent already has gets `-2`, `-3`, and so on. A deleted
   agent keeps its old name, so it takes no slug from a live agent.
6. **One helper gives the shown name:** `shownName(agent)` returns
   `agent.displayName ?? agent.name`. It lives in `server/agent-names.ts`,
   with `slugOf()`. That file imports nothing, so the app can import it, the
   same as `server/schemas.ts`.
7. **Where each name shows:**

   | Place                                                       | Shows                       |
   | ----------------------------------------------------------- | --------------------------- |
   | Sidebar agent row, author of a message, members panel       | display name                |
   | Working line, session panel, file lists, dialogs, `/` page  | display name                |
   | Avatar initials                                             | from the display name       |
   | Agent page breadcrumb, heading, toasts, action dialogs      | display name                |
   | Agent page heading, second line                             | `@username`                 |
   | Mention suggestions                                         | display name and `@username` |
   | Text that a mention puts in the composer                    | `@username`                 |
   | Name of a new group chat                                    | display names, joined       |
   | Name of a new DM                                            | display name                |

   The search of the `/` page and of the dialogs finds both names. The mention
   suggestions match the start of either name.
8. **An agent learns both names.** The prompt facts say
   `You are the agent "Foo Bar" (@foo-bar).`, and each member shows as
   `Foo Bar (@foo-bar)`. The `chat` MCP tools `list_agents` and
   `list_members` give `name` (the username) and `displayName` (the shown
   name, never null). An agent mentions with the username, as today.
9. **`listAgents()` sorts by the shown name**, because people read that list.

## Not in this change

- A stored group chat name or DM name does not change when an agent gets a
  new name. This is the current behaviour for a rename, and it stays.
- The form does not fill the username from the display name as you type.
  It is possible later.
- An old message that mentions an old name with spaces keeps its text. Such a
  mention did not match before either.

## Data

```
agents
  id                  TEXT PK
  name                TEXT NOT NULL      -- now the username, slug rule
  display_name        TEXT               -- NEW, null = show name
  colour, model, permission_mode, cwd, autostart, allowed_tools,
  disallowed_tools, system_prompt, created_at, description, max_turns,
  sleep_after_minutes, deleted_at
  UNIQUE INDEX agents_live_name ON agents (name) WHERE deleted_at IS NULL  -- NEW
```

No foreign key changes. The other tables point at `agents.id` only.

## Data flows

**Create or save an agent:**

1. The form checks the body with `agentSchema`: `name` fails the slug rule
   with a field message, and `displayName` trims, then an empty value
   becomes `null`.
2. `POST /api/agents` and `PATCH /api/agents/:id` check the schema, then ask
   the store for a live agent with that `name` and another `id`. If one
   exists, the route sends `409` with
   `fields: { name: "Another agent uses this username." }`.
3. The store writes `display_name`. The unique index is the last guard.
4. The page shows the `409` message under the Username field, as it does
   for a `400` field message.

**Migration 13:** add the column, then a JS step (new optional `run(db)` on a
migration) reads each agent, writes the slug and the display name, then
makes the index. All in the one transaction of the migration.

**Collision:** the worktree `conversation-rules` also adds a migration 13.
The second branch to merge takes 14. Check `master` before the merge.

## The form

The Identity section of the agent page:

```
Identity                         Display name
How people see the agent.        [ Foo Bar                    ]
                                 The name that people see. Leave it empty
                                 to show the username.

                                 Username
                                 [@][ foo-bar                 ]
                                 Lowercase letters, numbers and hyphens.
                                 Use it to mention the agent.

                                 Colour   ( ) ( ) ( ) ...
                                 Description [                ]
```

- The new-agent header says "A headless Claude Code agent. Only the username
  is necessary."
- The bar after an error names "Username" and "Display name" as fields.
- Messages:

  | Field         | Rule                         | Message                                                       |
  | ------------- | ---------------------------- | ------------------------------------------------------------- |
  | `name`        | not empty after a trim       | Give the agent a username.                                    |
  | `name`        | `^[a-z0-9-]+$`               | Use only lowercase letters, numbers and hyphens in a username. |
  | `name`        | not used by a live agent     | Another agent uses this username. (`409`, from the route)     |
  | `displayName` | none. Empty becomes `null`   |                                                               |

## Tests

The seams, each test-first with the `tdd` skill:

1. `agentSchema` through `checkBody()`: the slug rule, and an empty display
   name becomes `null`.
2. `slugOf()` and `shownName()`: the rows of the table in decision 5.
3. `openStore()` on a version 12 file: the migration gives the slugs, the
   display names and the `-2` suffix, and leaves a deleted agent alone.
4. The store: `createAgent()` and `updateAgent()` keep `displayName`, and
   `listAgents()` sorts by the shown name.
5. The HTTP routes: `POST` and `PATCH /api/agents` give `409` for a taken
   username, and accept the username of a deleted agent. A new group chat
   and a new DM take the display names.
6. `sessionFacts()`: the two lines of decision 8.
7. The MCP tools `list_agents` and `list_members`: `name` and `displayName`.
8. The agent page: the two fields, the body it sends, and the `409` message
   under Username.
9. The components: the sidebar row, the author of a message, the members
   panel and the mention suggestions show the display name. A pick of a
   suggestion puts `@username` in the composer.

## Docs to change when it lands

- `docs/store.md`: migration 13, the column, the index, the sort.
- `docs/forms.md`: the field table.
- `docs/web-app/agent-page.md`: the Identity section and the header.
- `docs/conversations.md` or `docs/agent-environment.md`: the prompt facts.
- `docs/mcp.md`: the two tool results.
- `docs/server.md`: the `409` of the agent routes.
