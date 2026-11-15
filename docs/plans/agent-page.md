# The agent page

**Status:** in progress. The user asked to plan and begin. Slices 1 and 2
have no open question, so they start now. Slices 3, 4 and 5 wait for the
answers to the open questions.

This is one Tier 3 item of `docs/plans/design-boards.md`: Description,
Maximum turns, the Command preview, Browse for the working directory, and
Stop agent and Restart session at the level of the agent.

## What the AgentConfig board shows

- **Header:** Stop agent (destructive), Restart session (outline), then Save
  agent.
- **Identity card:** Name, Colour, then **Description**, a one-line input
  ("Runs and fixes the Vitest tests.").
- **Runtime card:** the Working directory input has a **Browse** button at
  its end. Under it, **Maximum turns** (a number input, 140 px wide) and
  "Start when the app opens" sit in one row.
- **Command section** under the cards: a terminal icon, the heading
  "Command", the line "The app runs this in ~/code/web-app for each turn.",
  a Copy button, and a `pre` with the command. The values that come from the
  form are in colour.

The NewAgent board has none of these. The new agent form stays as it is,
except that it gets the two new fields, because both boards share the cards.

## What exists now

- `buildArgs(agent, session, context)` in `server/session/args.ts` gives the
  arguments. It imports `node:url` and the MCP tools, so the browser cannot
  import it.
- The arguments hold `--mcp-config` with the bearer token of the live
  session. **A preview must never show this token.**
- `claude` 2.1.311 does not list `--max-turns` in its help. On
  2026-11-15, `claude -p --max-turns 1 --no-such-flag-xyz` answered
  "unknown option '--no-such-flag-xyz'", so the parser accepts
  `--max-turns`. Its effect on a process with `--input-format stream-json`
  is not known: one limit for each prompt, or one for the whole process.
- `configOf()` in `server/http/server.ts` lists the fields of a process by
  name. A Description does not change a process. Maximum turns does.
- Stop turn and New session exist for one agent in one conversation
  (`docs/server.md`). Nothing acts on all the conversations of an agent.

## Decisions

1. **Description** is a new nullable column `agents.description`
   (migration 6). `agentSchema` gets `description: emptyAsNull()`. It shows
   in the Identity card of both screens. It is not in `configOf()`, and it
   does not go into a prompt.
2. **The Command preview is built in the browser, from the form values.** So
   it follows each change before Save. `server/session/agent-args.ts` holds
   `agentArgs(agent)`, the part of the arguments that comes from the agent
   (model, mode, tools, Maximum turns). It imports nothing from Node, as
   `server/schemas.ts` does. `buildArgs()` uses it, so the preview and the
   process cannot differ.
3. **The preview puts a placeholder in place of each value that the server
   makes for each session:** `--mcp-config '<chat server>'`,
   `--append-system-prompt '<rule>'` (plus `<system prompt>` when the agent
   has one), and `--resume <session id>`. The token is never in the
   browser.
4. **The line over the preview** says "The app starts this in <folder> for
   each conversation." The board says "for each turn", but the app starts
   one process for each agent in each conversation, and that process takes
   many turns.
5. **Copy** copies the text of the preview, placeholders included.
6. **Stop agent** (`POST /api/agents/:id/stop`) does Stop turn in each
   conversation of the agent, then stops each live process. The state of
   the agent becomes `exited`. The next message starts it again with
   `--resume`. It asks first in an `AlertDialog`, as New session does.

## Open questions

1. **Restart session: resume or forget?** My recommendation: Restart
   session stops each live process of the agent and starts it again with
   `--resume` of the same Claude session. So a new configuration applies at
   once, and the agent keeps its memory. New session (in the session panel)
   stays the way to forget.
2. **Maximum turns needs a live check.** One recording with
   `pnpm fixtures:record` (about 0.03 USD) tells what `--max-turns` does
   with `stream-json` input, and what the `result` line says when the limit
   comes. The timeline must show that end of turn. My recommendation: allow
   the recording. Until then, Maximum turns is not built.
3. **Browse needs a folder route on the server.** A browser cannot read the
   path of a folder on the disk. So Browse needs `GET /api/folders?path=`
   (the subfolders of a folder) and a dialog to move through them. The
   server listens only on `127.0.0.1`, and an agent can already run shell
   commands, so the route adds no new reach. But it is the largest part. My
   recommendation: move Browse to its own Tier 3 item, and leave it out of
   this change.

## Data flow

```
Agent page (form values, live)
  ├─ agentArgs(values)            server/session/agent-args.ts (no Node imports)
  │    └─ CommandPreview          fixed part + agentArgs + placeholders
  └─ Save ─▶ PATCH /api/agents/:id { …, description, maxTurns }
               └─ agents.description, agents.max_turns

start(row)                         server/http/server.ts
  └─ buildArgs(agent, row, context)
       └─ fixed part + agentArgs(agent) + --mcp-config (token) + rule + resume

Stop agent ─▶ POST /api/agents/:id/stop
  └─ for each live session of the agent: stopTurn(), handle.stop()
       └─ agent_state events on each conversation stream and the app stream
```

## Workflow

- **Description:** type, then Save agent, as each other field.
- **Command preview:** shows under the cards on a saved agent and on a new
  agent. It changes while the user types. Copy puts the text on the
  clipboard, and the button says "Copied" for 2 s.
- **Stop agent:** shows on a saved agent while the agent has a live process
  (its state is not `exited`). It asks "Stop test-runner?" with the points:
  each turn that runs stops, each waiting message is dropped, and the next
  message starts the agent again with its memory. A refusal shows in the
  alert of the page.
- **Restart session:** after question 1.

## The build

Test-first, one slice at a time. The seams: `buildArgs()` and
`agentArgs()` (exported functions), `createServer()`, `openStore()` for the
migration, and the agent page.

| Slice              | Tests                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Description     | A version 5 file opens with `description` null. The agent page saves and loads a description. An empty description is stored as null               |
| 2. Command preview | `buildArgs()` gives the same arguments as before. The page shows the command with the model, the mode and the tools, and it follows a change. Copy |
| 3. Stop agent      | The route stops the processes of the agent in two conversations, and leaves another agent alone. The page asks first, then sends the stop          |
| 4. Restart session | After question 1                                                                                                                                   |
| 5. Maximum turns   | After question 2: the argument, the stored value, the end of turn in the timeline                                                                  |

Docs in the same change: `docs/store.md` (migration 6), `docs/agents.md`
(`agentArgs()`, and `--max-turns` when it lands), `docs/server.md` (the
routes), `docs/web-app/agent-page.md`, `docs/forms.md` (the new fields), and
`docs/plans/design-boards.md`.
