# Headless agent sessions in the web app

**Status:** draft, awaiting go-ahead. The measurements are complete. The
decisions below are proposals. The open questions need an answer before the
build starts.

## The goal

A user talks to headless Claude Code agents in the browser. The user can:

- send a prompt in a DM, a group chat or a channel,
- see the turn as it runs: the text, each tool call and its result,
- answer a permission request (Deny, Allow once, Always allow),
- answer a question that the agent asks,
- stop a turn, and start a new session.

The screens are the seven artboards of the "Agent Chat" design canvas.

## What I measured

The multiplexer docs (`~/projects/go/claude-multiplexer/docs`) describe Claude
Code 2.1.176 to 2.1.231, as seen from Go. This machine runs Claude Code
**2.1.311**, and the latest TypeScript Agent SDK is **0.3.325** (it bundles
Claude Code 2.1.325). So I did not copy the multiplexer findings. I ran five
probes from Node 24 against the installed `claude`, with the Haiku model. The
probes cost 0.012 USD in total.

The probe script and the recorded lines are in the session scratchpad, not in
the repository. The build records new, cleaned fixtures (see "The build").

The command line of each probe:

```
claude -p --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --replay-user-messages
  --permission-prompt-tool stdio
  --strict-mcp-config --setting-sources project
  --model haiku --permission-mode default [--resume <session_id>]
```

### Findings

| # | Finding | Evidence |
|---|---|---|
| F1 | The multiplexer findings about the line protocol still hold: one JSON object for each line, `system/init` after the first input, `assistant`, `user`, `result`, and `stream_event`. | All probes |
| F2 | With `--permission-prompt-tool stdio`, Claude Code sends a `control_request` with the subtype `can_use_tool` on stdout, and the turn waits for a `control_response` on stdin. The multiplexer does not use this channel. | Probe "tools" |
| F3 | The request carries `tool_name`, `input`, `tool_use_id`, `description` and `permission_suggestions`. The answer is `{behavior: "allow", updatedInput, updatedPermissions?}` or `{behavior: "deny", message}`. | Probes "tools" and "ask" |
| F4 | **"Always allow" can grant more than the user sees.** For a `Write`, the only suggestion was `setMode acceptEdits`. After that, a later `rm` ran with no request. | Probe "tools" |
| F5 | Read-only commands (`echo`, `Read`) need no request in the `default` mode. `Write`, `Edit` and `rm` sent a request. | Probes "tools" and "ask" |
| F6 | **`AskUserQuestion` also goes through `can_use_tool`.** The host answers with `updatedInput.answers` (question text to label), and the model gets the answer. So the multiplexer interrupt for questions is not necessary with this flag. | Probe "ask" |
| F7 | Each tool result line carries `tool_use_result`, a structured result. `Read` gives `numLines`. `Edit` gives `structuredPatch` (hunks with `+` and `-` lines). `Write` gives `type: "create"`. `Bash` gives `stdout`, `stderr` and `interrupted`. | Probes "tools" and "ask" |
| F8 | Each tool result line carries `tool_result_meta[].permission_decision`: `accept` or `reject`, and the source (`config`, `user_temporary`, `user_reject`). | Probes "tools" and "ask" |
| F9 | A denied call returns a `tool_result` with `is_error: true` and the deny message. The `result` line lists it in `permission_denials`. | Probe "ask" |
| F10 | The `interrupt` control request works. The response is `{still_queued: []}`. The turn ends with `result` subtype `error_during_execution`, `is_error: true` and `terminal_reason: "aborted_streaming"`. The process stays alive. | Probe "interrupt2" |
| F11 | **A turn can start with no prompt.** Claude Code moved a `sleep 30` into a background job. When the job completed, it ran a new turn (`init`, `assistant`, `result`) by itself. | Probe "interrupt" |
| F12 | `--resume <session_id>` in a new process keeps the memory and the session ID. It does not write the old messages to stdout again. | Probe "resume" |
| F13 | The transcript of Claude Code (`~/.claude/projects/<dir>/<id>.jsonl`) has a different, internal shape (`api-request`, `attachment`, `queue-operation`). It is not the stream-json shape. | Probe "resume" |
| F14 | Text arrives in small pieces: 70 `text_delta` pieces of 8 characters on average, in 1.4 s. The multiplexer measured 150 characters for each piece on an older version. | Probe "interrupt2" |
| F15 | Claude Code sends `system/init` again at the start of each turn, not only once. | Probe "ask" |
| F16 | With `--replay-user-messages`, Claude Code also writes back each `control_response` that the host sent. | Probes "tools" and "ask" |
| F17 | The stream has many line types that the multiplexer does not list: `system/status`, `system/thinking_tokens`, `system/background_tasks_changed`, `rate_limit_event`. The SDK type `SDKMessage` is a union of 40 shapes. | All probes, `sdk.d.ts` |
| F18 | `total_cost_usd` on a `result` counts from the start of the process. A resumed process starts again from zero. | Probes "ask" and "resume" |
| F19 | The Agent SDK package is 5.4 MB, and its macOS binary package is 347 MB. It can run the installed `claude` with `pathToClaudeCodeExecutable`. | `npm view` |

### Not measured

- How long a `can_use_tool` request waits for an answer. A human can take
  hours. This needs a probe before the build.
- The turns of a subagent (`parent_tool_use_id`). The multiplexer describes
  them. I did not measure them again.
- Two sessions that write to the same folder at the same time.

## Decisions (proposed)

**D1. A Node server in the repository.** The browser cannot start a process.
So a TypeScript server in `server/` starts and holds the `claude` processes.
Node 24 runs `.ts` files with no build step. In development, Vite sends
`/api` to the server through its proxy.
Rejected: a Vite plugin (it runs only in development), and a move to Next.js
(a rewrite).

**D2. Our own small driver, not the Agent SDK.** The driver writes 5 kinds of
input line, and each one is measured: a prompt, `initialize`, the answer to
`can_use_tool`, `interrupt`, and `set_model` or `set_permission_mode`. It runs
the `claude` that the user installed, which is the same binary that the
agent configuration names. A fake `claude` script then makes the tests easy.
Rejected, but close: the Agent SDK. It gives typed messages and a
`canUseTool` callback, but it adds a 347 MB binary and hides the raw lines
that we store. **This is open question Q1.**

**D3. The decoder never fails on an unknown line.** It keeps the raw line and
ignores it (F17). This is the same rule as in the multiplexer.

**D4. The server turns lines into timeline items.** The browser does not see
the protocol. It gets items that match the design: a message, a tool call with
its result, a permission request, a question, a turn summary and a notice. A
pure reducer does the work, so it is easy to test.

**D5. The server stores two logs.** The raw lines of each session go to one
table, so that the timeline can be built again (F13 says that we cannot use the
Claude Code transcript). The timeline items go to a second table, so that the
browser can load a conversation fast.

**D6. One Claude session for each agent in each conversation.** The agent
"reviewer-bot" in `#release-train` and in a DM has two sessions. So the
context of one conversation does not go into another.

**D7. Permissions go through `can_use_tool`.** The buttons map like this:

| Button | Answer |
|---|---|
| Deny | `{behavior: "deny", message: "The user denied this."}` |
| Allow once | `{behavior: "allow", updatedInput: input}` |
| Always allow | `{behavior: "allow", updatedInput: input, updatedPermissions: suggestions}` |

Because of F4, the "Always allow" button shows what each suggestion grants,
for example "Lets this agent edit files with no request until the session
ends". If there is no suggestion, the button does not show.

**D8. Questions go through `can_use_tool` too (F6).** The question card sends
`updatedInput.answers`. The turn continues, and there is no interrupt.

**D9. The server groups text pieces.** It sends the pieces to the browser
at most every 50 ms (F14). The `assistant` line then replaces the text with
the final text.

**D10. Live updates use Server-Sent Events, and commands use POST.** Each
event has a sequence number. After a lost connection, the browser sends
`Last-Event-ID` and gets the events that it did not see. Rejected: a
WebSocket. It needs its own reconnect and replay code. **This is open
question Q3.**

## Open questions

- **Q1.** Our own driver (D2) or the Agent SDK?
- **Q2.** Is there one human user on one machine, or many users? The design
  shows "Sam Okafor" and "Dexter". Many users need sign-in. An agent can run
  shell commands, so the server must listen only on `127.0.0.1` until sign-in
  exists.
- **Q3.** Server-Sent Events and POST (D10), or a WebSocket?
- **Q4.** Storage. `node:sqlite` is in Node 24 and needs no package, but it
  is still marked as experimental. The alternative is `better-sqlite3`.
- **Q5.** Which settings does an agent load? The probes used
  `--setting-sources project` and `--strict-mcp-config`, so that the user's
  hooks, MCP servers and memory files did not apply. An agent that loads the
  user settings gets the user's tools and rules, but it also gets the user's
  hooks.
- **Q6.** In a channel, does an agent see each message, or only the messages
  since its last turn? The proposal: when a user @mentions an agent, the prompt
  holds the channel messages since that agent's last turn, each with its
  author.
- **Q7.** Can an agent @mention another agent? If yes, the server needs a
  limit on the chain, so that two agents do not talk for ever.
- **Q8.** What happens to an open permission request when the server
  stops? The child process stops too, so the request cannot get an answer. The
  proposal: mark it "Expired", and resume the session on the next prompt.
- **Q9.** What does "New session" keep? The proposal: a new Claude session ID,
  the same agent configuration, and the old timeline stays visible above a
  divider.

## The parts

```
 Browser (Vite + React)                    Server (Node 24, TypeScript)
+----------------------------+           +------------------------------------+
| pages, shadcn components   |  POST     | HTTP routes                        |
| useConversation()  --------+---------> |   send prompt, answer request,     |
|   timeline items           |           |   interrupt, new session, config   |
|                    <-------+-----------+ SSE stream (seq, item patches)     |
+----------------------------+  events   |                                    |
                                         | ConversationService                |
                                         |   mentions, prompt for the agent   |
                                         |                                    |
                                         | AgentSession (one per agent and    |
                                         |   conversation)                    |
                                         |   queue, state, control requests   |
                                         |        |  stdin / stdout            |
                                         |        v                           |
                                         |   claude -p (child process)        |
                                         |                                    |
                                         | decodeLine() -> reduceTimeline()   |
                                         | Store (SQLite)                     |
                                         +------------------------------------+
```

## ERD

All tables are new.

```
agents                              conversations
+------------------------+          +------------------------+
| PK id          text    |          | PK id          text    |
|    name        text    |          |    kind        text    |  channel | group | dm
|    colour      text    |          |    name        text    |
|    model       text    |          |    topic       text    |
|    permission_mode text|          |    private     integer |
|    cwd         text    |          |    reply_mode  text    |  mention | every
|    max_turns   integer |          |    created_at  text    |
|    autostart   integer |          +-----------+------------+
|    allowed_tools  json |                      | 1
|    disallowed_tools json|                     |
|    system_prompt text  |                      | N
|    created_at  text    |          conversation_members
+-----------+------------+          +------------------------+
            | 1                     | PK,FK conversation_id  |  ON DELETE CASCADE
            |                       | PK    member_key  text |  "agent:<id>" | "user:<id>"
            | N                     |    FK agent_id  text   |  nullable, ON DELETE CASCADE
agent_sessions                      +------------------------+
+------------------------------+
| PK id                text    |
| FK agent_id          text    |  ON DELETE CASCADE
| FK conversation_id   text    |  ON DELETE CASCADE
|    claude_session_id text    |  from system/init
|    state             text    |  starting | idle | busy | waiting | exited | failed
|    cost_usd          real    |
|    turns             integer |
|    started_at        text    |
|    ended_at          text    |
+--------------+---------------+
               | 1
               | N
session_events                      timeline_items
+------------------------------+    +--------------------------------+
| PK,FK session_id  text       |    | PK id              text        |
| PK    seq         integer    |    | FK conversation_id text        |  ON DELETE CASCADE
|       direction   text       |    |    seq             integer     |  order in the conversation
|       line        json       |    | FK session_id      text        |  nullable, ON DELETE SET NULL
|       at          text       |    |    author_key      text        |
+------------------------------+    |    kind            text        |  message | tool_call | permission
  ON DELETE CASCADE                 |                                |  | question | turn | notice
                                    |    tool_use_id     text        |  pairs a call and its result
                                    |    status          text        |  running | done | error | pending
                                    |                                |  | allowed | denied | expired
                                    |    payload         json        |
                                    |    created_at      text        |
                                    +--------------------------------+
```

- An agent has many sessions. A conversation has many sessions, one for each
  agent member, and one more after each "New session".
- A conversation has many members. A member is a user or an agent.
- A session has many raw events. A conversation has many timeline items.
- `session_events` is the source of truth. `timeline_items` can be built again
  from it.

## Data flows

**A prompt in a DM.**

1. The browser shows the prompt at once, as a pending item.
2. `POST /api/conversations/:id/messages` stores a `message` item.
3. The server finds the session of the agent, or starts one (`--resume` if a
   Claude session ID exists).
4. The session writes the prompt line to stdin, and the state goes to `busy`.
5. Each stdout line goes to `session_events` first. Then `decodeLine()` reads
   it, and `reduceTimeline()` makes item patches.
6. The patches go to the store and to the SSE stream.
7. The replayed prompt (`isReplay`) confirms the pending item.
8. The `result` line closes the turn. The state goes to `idle`, and the next
   queued prompt goes.

**A tool call.**

```
assistant  tool_use {id, name, input}   -> tool_call item, status running
user       tool_result {tool_use_id}    -> same item: status done or error,
           + tool_use_result               summary: "+1 −1", "4 lines", stdout
           + tool_result_meta              note: "Allowed by you"
```

**A permission request.**

```
control_request can_use_tool   -> permission item, status pending
                                  session state: waiting, dot: waiting
user clicks a button           -> POST /api/requests/:id {decision}
server writes control_response -> item status allowed or denied
                                  session state: busy
```

**A question.** The same as a permission request. The item kind is
`question`, and the answer is `updatedInput.answers`.

**Stop turn.** `POST /api/sessions/:id/interrupt` writes the `interrupt`
control request. The `result` line with `aborted_streaming` closes the turn
as "Stopped".

**A turn with no prompt (F11).** The reducer does not need a prompt to start
a turn. Each `assistant` line after a `result` opens a new turn.

**A server restart.** Each live process stops. Each open request becomes
`expired` (Q8). The next prompt starts the session again with `--resume`.

## Events to the design

| Line | Design element |
|---|---|
| `system/init` | Session card: model, permission mode, folder, session ID, tools |
| `stream_event` `text_delta` | The message text while it arrives |
| `assistant` `text` | The final message text |
| `assistant` `tool_use` | A tool-call card: tool name and the main input (path, command or pattern) |
| `user` `tool_result` and `tool_use_result` | The result in the card: `+19`, `4 lines`, Bash output, or an error |
| `control_request` `can_use_tool` | The approval card (Deny, Allow once, Always allow), or the question card |
| `result` | The turn summary: time, cost and turns. Session card: turns and cost |
| `system/task_*` | A background job line in the timeline |
| `system/status`, `thinking_tokens` | The "working" status dot |
| `rate_limit_event` | A notice when `status` is not `allowed` |
| Each other line | Stored, and not shown |

The status dot of an agent maps from the session state:

| State | Dot |
|---|---|
| `idle` | online |
| `busy` | working |
| `waiting` (a request or a question is open) | waiting |
| `failed` | error |
| `exited`, or no session | idle |

## The build

Each step is a vertical slice with tests first. The seams:

| Seam | Test |
|---|---|
| `decodeLine(text)` | Recorded, cleaned fixtures: each line type, an unknown type, a line that is not JSON |
| `reduceTimeline(items, event)` | A tool call and its result pair. An edit gives `+1 −1`. A denied call gives an error item. An interrupt gives "Stopped". A turn with no prompt opens a turn |
| `AgentSession` | A fake `claude` script (Node) with modes, as in the multiplexer: lazy init, a permission request, a crash, a line that is not JSON |
| `buildArgs(agent, session)` | The command line from an agent configuration |
| HTTP routes and SSE | Requests against the server with a fake session |
| Browser hooks and pages | Testing Library with a fake event stream |

The order:

1. Record the fixtures again with a probe script in `scripts/`. Remove the
   paths of this machine.
2. `server/protocol`: the decoder and the encoder.
3. `server/timeline`: the reducer.
4. `server/session`: `AgentSession` and the fake `claude`.
5. The store and the schema.
6. The routes and the SSE stream.
7. The DM screen and the agent configuration screen.
8. Group chats, then channels and mentions.

Each step lands in its own worktree. `docs/agents.md` and `docs/protocol.md`
get the parts that stay true, and this plan gets smaller after each step.

**Live check.** After step 6, one test runs the real `claude` with Haiku. It
runs only when a flag is set, because it costs money (about 0.01 USD).

## Risks

- **Version drift.** The stream changes between Claude Code versions (F14,
  F17). The decoder ignores what it does not know. The session card shows
  `claude_code_version` from `init`.
- **Shell access.** An agent runs commands on this machine. The server
  listens only on `127.0.0.1` (Q2).
- **Cost.** Each agent in a channel with the "Every message" mode pays for
  each message. The design already says this.
