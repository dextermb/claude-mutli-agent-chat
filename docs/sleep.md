# Sleep and wake

An agent can stay in a DM, a group chat or a channel for weeks. A process
that waits costs memory: about 460 MB with the MCP servers of the user
(F53 in `docs/protocol.md`). So
after an idle time, the server stops the process of an agent session. This
is sleep.

The Claude session stays. The next message, mention, `send_message` or
Restart starts a process with `--resume` (`docs/agents.md`), as for each
process that stopped. The agent remembers the conversation.

## The sleep time

The server takes the first value that is set:

1. `sleepAfterMinutes` of the channel, in the channel settings.
2. `sleepAfterMinutes` of the agent, on the agent form.
3. The app value: `AGENTS_SLEEP_AFTER_MINUTES`, or 15.

A DM and a group chat have no settings, so there the agent decides. 0 means
never. Both forms take a whole number from 0 to 55, or empty
(`server/schemas.ts`, `docs/forms.md`). The limit is under 60, because the
prompt cache of Claude Code lives one hour (F47). A compaction within the hour
reads the context from the cache.

## The timer

```
state idle → deliverNext(): nothing in the queue
  → armSleep(): one timer for each live session, in memory
any other state (busy, waiting, starting, exited) → clearSleep()
timer fires → fallAsleep()
  → guard: idle, nothing in the queue, no background job that runs
  → context ≥ compactAboveTokens?
       yes → prompt COMPACT_PROMPT, then at the next idle → stopAsleep()
       no  → stopAsleep()
stopAsleep() → end_reason = "sleep" → handle.stop() → exited
```

- A prompt, an answer to a card, or a turn that a background job starts
  makes the state busy, so the timer stops. The next idle starts it again.
- A background job keeps the agent awake. The server keeps the tool calls
  whose `job.status` is `running`, from the timeline items of the process.
- An approval card or a question card keeps the state `waiting`, so no timer
  runs.
- A message that comes while the agent compacts gets its turn. The agent then
  stays awake, and the next idle starts the timer again.
- No timer runs after a server start, because no process is alive then.
- `close()` of the server clears each timer.

## The compaction before the stop

When the context of the last turn (`context.used` of the turn item,
`docs/timeline.md`) is `compactAboveTokens` or more, the server first sends
`/compact` with the text of `agent/compact.md`. The app value is
`AGENTS_COMPACT_ABOVE_TOKENS`, or 100,000. Under about 100k, a compaction
saves little, because the base of each session is 45k to 55k tokens and a
compaction cannot go below it (F48). Claude Code compacts by itself only at
the window minus 33,000 tokens, which is about 967,000 on a model with a
window of 1M (F63). So for an agent, the compaction before the stop is the
one that keeps the context small.

The compaction comes back as a `compaction` item (F41, F42 in
`docs/protocol.md`). The user's `PreCompact` and `SessionStart` hooks run (F57, F58), as
for each compaction. Each agent process has `AGENT_CHAT=1` in its
environment, and a hook gets it (F61), so a hook script can test it and skip
its work in an agent. A `PreCompact` hook that exits with code 2 blocks the
compaction (F61). The agent then sleeps with its full context, and the
compaction item ends as `failed` (F62).

## The wake

A message, a mention, a `send_message` or Restart starts a process with
`--resume`. Its first prompt starts with a `[Chat app]` block, in this order:

```
[Chat app] You were asleep for 3 h 12 min.        after a sleep of 1 h or more
[Chat app] This session:                          each new process (docs/agent-environment.md)
- …
[Chat app] 212 messages came since your last turn. Here are the last 30. Use read_messages for the older ones.
[Chat app] The summary of the conversation before these messages:
- …
```

- The gap comes from `ended_at` of the session row that ended with `sleep`.
  A shorter sleep gives no line, because the prompt cache still holds the
  context.
- In a group chat or a channel, each prompt holds at most the last 30
  messages since the last turn of the agent (`AGENTS_WAKE_MESSAGES`,
  `docs/conversations.md`). This limit is for each prompt, not only after a
  sleep.

## The conversation summary

When a prompt leaves messages out, the server adds a summary of the
conversation up to the last message that it leaves out (`through_seq`):

```
prompt() → promptFor(): omittedThrough = seq of the last message left out
  → the prompt goes into the queue, not ready
  → summaryThrough(conversation, omittedThrough)
       a run for this conversation goes on? wait for it
       latest summary covers omittedThrough? use it
       else runSummary(): summarize({ earlier, lines })
            earlier: the latest summary, or null
            lines:   each message after its through_seq, up to omittedThrough,
                     of each author, at most the last 400
            save it in conversation_summaries
  → the note gets the summary, the prompt is ready → deliverNext()
```

- Haiku runs only when a prompt leaves messages out and the stored summary
  does not reach far enough. So a DM never needs it, and a quiet group chat
  seldom does.
- Each run is an update: the earlier summary and the new messages only.
- One summary serves each agent of the conversation, and one run at a time
  goes on for each conversation. A second agent with the same cut waits for
  that run and uses its result.
- A prompt that waits for its summary keeps its place in the queue, so the
  prompts keep their order.
- If the run fails, or takes more than 30 s, the prompt goes out with the
  pointer to `read_messages` only.

`claudeSummarizer()` (`server/summary/summarizer.ts`) is the only process
that does not get the environment of an agent. It is not an agent: it reads
text and has no tools. It runs `claude -p --output-format json` with
`--system-prompt` (`agent/summarize.md`), `--tools ""`, no MCP server, the
project settings only, and `--no-session-persistence`, in the folder
`summarizer` under the scratch folder. Its base is about 1k tokens, so one
run costs about 0.0003 USD for a few messages and about 0.003 USD for 200
(F46 in `docs/protocol.md`). In a live check, it took 2.8 s.

## A transcript that is gone

Claude Code deletes a transcript 30 days after its last turn (F43, F44 in
`docs/protocol.md`). The user sets this period with `cleanupPeriodDays` in
the user settings. The app does not set it, because the sweep is shared: the
value of one process decides for each transcript of the user on that day
(F45).

A `--resume` of a deleted transcript fails: stderr "No conversation found
with session ID", exit code 1, and no answer to `initialize` (F30). The server
then does not show a failure. It starts again:

```
state failed + that stderr + the row resumed an ID (not claude_session_new)
  → new session row, a new Claude session ID, --session-id
  → a session_start item: the divider "New session"
  → the prompt that waited, with this note first:
[Chat app] Claude Code deleted the transcript of your earlier session, so this is a new session. Use read_messages for the earlier messages of this conversation.
[Chat app] The summary that you kept in your earlier session:
<the summary of the last compaction of the earlier Claude session>
```

The summary comes from our database (`lastCompaction()`, `docs/store.md`),
so the sweep cannot delete it. An agent with no compaction gets only the
first line. Its memory is then the prompt and `read_messages`.

## What the user sees

- The process exits, and the agent shows as stopped.
- The session card says "Asleep since 14:02. The next message wakes it." It
  comes from `asleepSince` of the card: the `ended_at` of the latest session
  row when its `end_reason` is `sleep` and no process of it runs
  (`docs/server.md`).
- A compaction shows as a divider in the thread
  (`docs/web-app/conversation.md`).
- A new session after a lost transcript shows as the divider "New session".

## Tests

`createServer()` takes `minuteMs` (60,000 by default). A test gives 20, so one
minute of sleep time lasts 20 ms, with real timers, real HTTP and the fake
`claude`. The fake mode `hold-after-result` stops the output after the first
`result` line, so a background job stays `running`. The fake mode
`no-transcript` fails as in F30 when it starts with `--resume`, and plays the
fixture when it starts with `--session-id`. `wakeMessages` sets the limit of
messages for a test.

A server test gives `createServer()` its own `summarize` function. The test
of `claudeSummarizer()` runs `server/test/fake-summarizer.ts` in place of
`claude`. The fake writes its arguments and its input to a log, then prints
`summarize.json`, or fails, or hangs (`FAKE_SUMMARIZER_MODE`).

## Not measured yet

- A wake after more than one hour. F47 gives the cache time, and the costs
  come from the measured prices, not from a probe that waited.
