# The timeline

The browser does not read the Claude Code stream. The server turns the stream
of each agent session into timeline items, and each item matches one element
of the design: a message, a tool-call card, an approval card, a question card
or a turn summary.

`server/timeline/reduce.ts` does this work. It is a pure function, so a test
can feed it recorded lines and check the items.

## The reducer

```ts
reduceTimeline(state: TimelineState, line: DecodedLine): TimelineStep
// TimelineStep = { state: TimelineState; changes: TimelineItem[] }
```

- Start each session with `emptyTimeline()`.
- Give the reducer each stdout line, after `decodeLine()`, in order.
- `changes` holds each item that the line added or changed, with its new
  value. The store writes these items, and the browser gets them on the event
  stream.
- `state.items` holds all items of the session, in order.

Give the reducer the stdout lines only. Claude Code writes back each answer
that the server sends (F16 in `docs/protocol.md`). So the echo on stdout
tells the reducer that Claude Code got the answer. If the reducer also got
the line that the server sent, it would apply each answer two times.

## Items

Each item has an `id` (`item-1`, `item-2`, …), unique in its session, and a
`kind`.

| `kind`       | From                                                          | Statuses                                  |
| ------------ | ------------------------------------------------------------- | ----------------------------------------- |
| `message`    | `text_delta` pieces, then the `assistant` text block          | `streaming`, `done`                       |
| `tool_call`  | An `assistant` `tool_use` block, then its `tool_results`      | `running`, `done`, `error`, `stopped`     |
| `permission` | A `permission_request`, then its `permission_answer`          | `pending`, `allowed`, `denied`, `expired` |
| `question`   | A `permission_request` for `AskUserQuestion`, then its answer | `pending`, `answered`, `expired`          |
| `turn`       | A `result` line                                               | `done`, `stopped`, `limit`                |
| `compaction` | `compaction_status`, `compact_boundary`, then the summary     | `running`, `done`                         |

### Messages

The first text piece adds a message with the status `streaming`. Each next
piece adds its text to the same message. The `assistant` text block then
replaces the text with the final text, and the status becomes `done`. If no
piece came first, the `assistant` text block adds a message that is `done`.

### Tool calls

A tool call keeps the tool `name`, its `input`, the permission `decision` of
Claude Code (for example `user_temporary` or `user_reject`), and a `result`:

| `result.kind` | From                                                           | The design shows       |
| ------------- | -------------------------------------------------------------- | ---------------------- |
| `lines`       | Read: `file.numLines`                                          | `4 lines`              |
| `diff`        | Edit: the `+` and `-` lines of `structuredPatch`               | `+1 −1`, and the lines |
| `diff`        | Write of a new file (`type: "create"`): the lines of `content` | `+1`, and the lines    |
| `output`      | Bash: `stdout` and `stderr`                                    | The output             |
| `error`       | A result with `is_error`, for example a denied call            | The error text         |

Any other tool gives `result: null`.

A `diff` also keeps `lines`: each line with its `kind` (`add`, `remove` or
`same`) and its `text`, with no `+` or `-`. It keeps the first 200 lines, and
`more` counts the lines that it drops, so a large Write does not fill the
store. A `diff` that was stored before this rule has no `lines`, and the
browser then shows only the counts.

A Bash call with `run_in_background` starts a job. The `task` lines put
`job: { taskId, status }` on the tool call: `running` at the start, then the
status of the last `task` line, for example `completed`.

### Approval cards and question cards

A `permission_request` adds an approval card with the tool, its input and the
suggestions of Claude Code. The answer moves it to `allowed` or `denied`. The
store sets `expired` on a card that is still open when the server starts again
(`docs/store.md`).

`AskUserQuestion` is different. Its `tool_use` block does not add a tool
call. Its `permission_request` adds a question card with the `questions`, and
the answer sets `answers` and the status `answered`.

### Turns

Each `result` line adds a turn summary with `durationMs`, `costUsd` and
`numTurns`. `costUsd` is the cost of that turn only. `total_cost_usd` counts
from the start of the process (F18), so the reducer subtracts the total of
the turn before it in the same process. A turn item that was stored before
this rule holds the process total until `rebuildTimeline()` runs on its
session. A turn that ends with `terminal_reason: "aborted_streaming"` (an
interrupt while text arrives, F10) or `"aborted_tools"` (an interrupt while a
tool runs, F28) is `stopped`. Claude Code first answers the tool
call that ran with an error `tool_result`. When the `aborted_tools` result
comes, the reducer gives the last tool call of the turn the status
`stopped`, if its status is `error`, and drops its result. The browser shows
"Stopped".

A turn also keeps `context: { used, window }`: how full the context of the
agent is at the end of the turn. `used` is `contextTokens` of the last
`assistant` line of the main agent (`docs/protocol.md`). The input of each
request holds the whole conversation, so the last request shows the context
now. A line of a subagent does not count, because a subagent has its own
context. `window` is the `contextWindow` of the model of that line, from the
`result` line. A turn with no such line, or no window for its model, has no
`context`.

A turn that ends with `terminal_reason: "max_turns"` (the turn limit of the
agent, F36) is `limit`. The turns of a limit come from `--max-turns`, so the
reducer needs no other field of the `result` line.

A turn does not need a prompt. A background job that ends after the turn
starts a new turn (F11). Its message and its summary come after the summary of
the first turn.

### Compactions

Claude Code compacts the context of a session when the server sends
`/compact`, or when the context gets near its window (F41 in
`docs/protocol.md`):

```
compaction_status "compacting"   → adds a compaction item, running
compact_boundary                 → sets trigger, preTokens and postTokens
synthetic_text                   → sets the summary, and the status done
result                           → a turn, as for each prompt
```

- The reducer changes only a compaction that runs. A `compact_boundary` or a
  `synthetic_text` line with no running compaction changes nothing.
- `trigger` is `manual` for `/compact`. An automatic compaction is not
  recorded yet.
- The summary (F42) is the text that the agent keeps in place of the old
  context.
- The browser does not show a compaction item yet.
- A compaction item is not unread (`docs/store.md`).

### Subagents

Each tool call has a `parentToolUseId` (F22). It is `null` for a call of the
main agent. For a call of a subagent, it is the `toolUseId` of the `Agent`
call that started the subagent. The browser shows such a call inside the card
of its `Agent` call, not at the top level. The tool results of a subagent
have no `tool_use_result`, so their `result` is `null`.

### Session start

The server adds a `session_start` item when the user starts a new session
(`docs/server.md`). It holds the new `claudeSessionId`. The reducer never
adds it. The browser shows it as a divider, not in the block of the agent.

### Notices

A `rate_limit` line with a status other than `allowed` adds a `notice` item
with `reason: "rate_limit"`, the `status`, the `rateLimitType` (for example
`five_hour`) and `resetsAt` (seconds since 1970). It adds a notice only when
the status differs from the status of the last `rate_limit` line, so a run of
the same status gives one notice. The browser makes the text, because only
the browser knows the local time zone.

The server adds the other kind of notice, `reason: "failed"`, when a process
fails (`docs/server.md`). It holds the `exitCode` and the `stderr`. The
reducer never adds it.

## The text of a subagent

Only a tool call gets `parentToolUseId`, because Claude Code sends no text of
a subagent (F32 in `docs/protocol.md`). The reducer test of
`subagent-text.jsonl` checks that only the answer of the main agent is a
message. If a new version of Claude Code sends that text, the test fails,
and the reducer must then put the text inside its `Agent` card.
