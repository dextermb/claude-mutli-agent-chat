# Sleep

An agent can stay in a DM, a group chat or a channel for weeks. A process
that waits costs memory: about 460 MB with the MCP servers of the user. So
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
prompt cache of Claude Code lives one hour. A compaction within the hour
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
compaction cannot go below it.

The compaction comes back as a `compaction` item (F41, F42 in
`docs/protocol.md`). The user's `PreCompact` and `SessionStart` hooks run, as
for each compaction. Each agent process has `AGENT_CHAT=1` in its
environment, so a hook script can test it and skip its work in an agent.

## What the user sees

- The process exits, and the agent shows as stopped.
- The session card says "Asleep since 14:02. The next message wakes it." It
  comes from `asleepSince` of the card: the `ended_at` of the latest session
  row when its `end_reason` is `sleep` and no process of it runs
  (`docs/server.md`).
- A compaction shows as a divider in the thread
  (`docs/web-app/conversation.md`).

## Tests

`createServer()` takes `minuteMs` (60,000 by default). A test gives 20, so one
minute of sleep time lasts 20 ms, with real timers, real HTTP and the fake
`claude`. The fake mode `hold-after-result` stops the output after the first
`result` line, so a background job stays `running`.
