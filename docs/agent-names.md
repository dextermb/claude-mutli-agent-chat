# Agent names

Each agent has two names:

- The **username**, for example `test-runner`. People and agents type it in
  an @mention. The prompts and the `[Author]` lines that an agent reads use
  it. It is the `name` field and the `name` column.
- The **display name**, for example `Test Runner`. People read it in the
  app. It is the `displayName` field and the `display_name` column. It is
  optional.

`server/agent-names.ts` holds `shownName(agent)`, which gives the display
name, or the username when the display name is `null`. It also holds
`slugOf(name)`. The file imports nothing, so the app imports it too.

## The rules

| Field         | Rule                                                             | Where                       |
| ------------- | ---------------------------------------------------------------- | --------------------------- |
| `name`        | Not empty. Only lowercase letters, numbers and hyphens           | `agentSchema` (`forms.md`)  |
| `name`        | No other agent that is not deleted has it. Else `409`            | The agent routes, the index |
| `displayName` | Optional. The schema trims it, and an empty value becomes `null` | `agentSchema`               |

The route checks a taken username before it saves, and answers `409` with
`fields: { name: "Another agent uses this username." }`. The unique index
`agents_live_name` (`name`, where `deleted_at` is null) is the last guard. A
deleted agent frees its username, and a new agent can take it.

The slug rule is the rule of a channel name. A username with a space or a
capital letter cannot match a mention, because a mention stops at a space.

## Where each name shows

| Place                                                     | Name                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| The sidebar, the author of a message, the members panel   | Display name                                                           |
| The working line, the session panel, the file lists       | Display name                                                           |
| The dialogs, the `/` page, the delete confirm, the toasts | Display name                                                           |
| The DM header, its first line, and its message box label  | Display name                                                           |
| The agent page: breadcrumb and heading                    | Display name, then `@username`                                         |
| The mention list of the message box                       | Display name, and `@username` after it if the agent has a display name |
| The text that a pick of the mention list puts in the box  | `@username`                                                            |
| The marked mentions in a message                          | `@username`                                                            |
| The name of a new group chat, and of a new DM             | Display names                                                          |

A search in the `/` page and in the dialogs matches either name. The mention
list matches the start of either name.

The stored name of a group chat or a DM does not change when an agent gets a
new name. The DM header and the sidebar row read the agent, so they show the
new name.

## What an agent learns

- The facts of a session say `You are the agent "Test Runner"
(@test-runner).`, and each member with a display name shows as
  `Test Runner (@test-runner)`. An agent with no display name keeps the
  short form, `You are the agent "test-runner".` See
  `agent-environment.md`.
- `get_conversation` and `list_agents` give `name`, the username, and
  `displayName`, which is never null (`mcp.md`).
- The rule in `agent/environment.md` tells the agent to mention with the
  username.

## The migration

Migration 13 (`store.md`) adds `display_name`. Then its step `giveUsernames`
makes a username from each old name of an agent that is not deleted:

| Old `name`    | `name`          | `display_name` |
| ------------- | --------------- | -------------- |
| `test-runner` | `test-runner`   | `null`         |
| `Test Runner` | `test-runner-2` | `Test Runner`  |
| `Ops_Bot 2`   | `ops-bot-2`     | `Ops_Bot 2`    |
| `!!!`         | `agent`         | `!!!`          |

An old name that already fits the rule keeps it first. Then each other agent
gets its slug, in the order of `created_at`. A slug that is taken gets `-2`,
`-3`, and so on. In the table, `Test Runner` gets `-2` because `test-runner`
already exists. A deleted agent keeps its old name.

An old message that mentions an old name with a space keeps its text. That
mention did not match before either.
