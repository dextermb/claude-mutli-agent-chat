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

| `kind`       | From                                                          | Statuses                       |
| ------------ | ------------------------------------------------------------- | ------------------------------ |
| `message`    | `text_delta` pieces, then the `assistant` text block          | `streaming`, `done`            |
| `tool_call`  | An `assistant` `tool_use` block, then its `tool_results`      | `running`, `done`, `error`     |
| `permission` | A `permission_request`, then its `permission_answer`          | `pending`, `allowed`, `denied` |
| `question`   | A `permission_request` for `AskUserQuestion`, then its answer | `pending`, `answered`          |
| `turn`       | A `result` line                                               | `done`, `stopped`              |

### Messages

The first text piece adds a message with the status `streaming`. Each next
piece adds its text to the same message. The `assistant` text block then
replaces the text with the final text, and the status becomes `done`. If no
piece came first, the `assistant` text block adds a message that is `done`.

### Tool calls

A tool call keeps the tool `name`, its `input`, the permission `decision` of
Claude Code (for example `user_temporary` or `user_reject`), and a `result`:

| `result.kind` | From                                                           | The design shows |
| ------------- | -------------------------------------------------------------- | ---------------- |
| `lines`       | Read: `file.numLines`                                          | `4 lines`        |
| `diff`        | Edit: the `+` and `-` lines of `structuredPatch`               | `+1 −1`          |
| `diff`        | Write of a new file (`type: "create"`): the lines of `content` | `+1`             |
| `output`      | Bash: `stdout` and `stderr`                                    | The output       |
| `error`       | A result with `is_error`, for example a denied call            | The error text   |

Any other tool gives `result: null`.

A Bash call with `run_in_background` starts a job. The `task` lines put
`job: { taskId, status }` on the tool call: `running` at the start, then the
status of the last `task` line, for example `completed`.

### Approval cards and question cards

A `permission_request` adds an approval card with the tool, its input and the
suggestions of Claude Code. The answer moves it to `allowed` or `denied`.

`AskUserQuestion` is different. Its `tool_use` block does not add a tool
call. Its `permission_request` adds a question card with the `questions`, and
the answer sets `answers` and the status `answered`.

### Turns

Each `result` line adds a turn summary with `durationMs`, `costUsd` and
`numTurns`. A turn that ends with `terminal_reason: "aborted_streaming"` (an
interrupt) is `stopped`.

A turn does not need a prompt. A background job that ends after the turn
starts a new turn (F11). Its message and its summary come after the summary of
the first turn.

## Not handled yet

- The lines of a subagent show at the top level, as if the main agent sent
  them. The subagent's tool results have no `tool_use_result`, so their
  `result` is `null`.
- A `rate_limit` line with a status other than `allowed` does not add a
  notice.
- A request that is open when the server stops does not become `expired`.
