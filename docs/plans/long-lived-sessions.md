# Long-lived agents: sleep, wake and memory

**Status:** draft, awaiting go-ahead. The measurements are done
(2026-11-16, Claude Code 2.1.311, Haiku 5.5, about 0.15 USD). Nothing is
decided yet. The section "Open questions" holds the decisions for the user.

An agent can stay in a DM, a group chat or a channel for weeks. Today, its
`claude` process never stops on its own, and its Claude session grows until
Claude Code compacts it. This plan gives the agent a sleep and a wake:

- **Sleep.** After an idle time that the user sets, the server stops the
  process. If the context is large, the server first compacts it.
- **Wake.** The next message starts a process again. The prompt tells the
  agent what it missed, in a size that has a limit.

## What happens today

```
message ──▶ liveSessionFor() ──▶ live process? ──yes──▶ queue ──▶ prompt
                                      │no
                                      ▼
                     new row, --resume <claude session id>
                     (the process then stays alive until:
                      Stop agent, Restart, New session, server stop,
                      member removed, or a crash)
```

| Fact of today                                                | Result                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| A process stays alive with no limit                          | About 460 MB of memory for each agent in each conversation         |
| The prompt holds each message since the last turn            | After a long sleep in a busy channel, the prompt has no size limit |
| The rule (with "This session" facts) is in the system prompt | A resumed session does **not** get the new facts (F38)             |
| Claude Code compacts only at its context window              | Each request of a large session reads the full context             |

## Measurements

The probes used the stream-json flags of the app, `--setting-sources
user,project`, and Haiku. The numbers in the column "Tokens" are the context
of the last request: input, cache write (`cw`) and cache read (`cr`). When the
plan ships, these findings move into `docs/protocol.md`.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F38 | **A resume keeps the system prompt of the first request.** `--system-prompt-snapshot` is `on` by default. A first process had `--append-system-prompt "The codeword is ALPHA."`. A `--resume` with "BETA" answered `ALPHA`. With `--system-prompt-snapshot off` on both processes, it answered `BETA`. The help says that the snapshot stays "until the conversation is compacted".                                                                                                                                                                      |
| F39 | **The prompt cache lives one hour.** Each cache write is `ephemeral_1h_input_tokens`. A cache write costs 20 times a cache read (Haiku: 0.20 against 0.01 USD for each million tokens, from the measured costs).                                                                                                                                                                                                                                                                                                                                         |
| F40 | **`/compact <instructions>` works as a stream-json prompt.** The turn writes `system/status` (`"compacting"`), the user's `PreCompact` hook lines, `system/init`, `system/compact_boundary` with `compact_metadata` (`trigger: "manual"`, `pre_tokens`, `post_tokens`, `preserved_segment`), a `user` line whose `content` is a string (the summary), a replayed `user` line with `<local-command-stdout>`, and `result/success` with no text. No `assistant` line comes. 43k → 17k tokens in 4.3 s for 0.009 USD, and 53k → 16k in 6.7 s for 0.011 USD. |
| F41 | **The summary text is on stdout.** The `user` line after `compact_boundary` starts with "This session is being continued from a previous conversation…" and holds the summary in Claude Code's own sections. The decoder of today makes it `unknown`.                                                                                                                                                                                                                                                                                                    |
| F42 | **Compaction cannot go below the base.** After `/compact`, Claude Code attaches the skill list, the deferred tools, the MCP instructions and the hook output again. A small session went from 43k to 55k tokens at its next request.                                                                                                                                                                                                                                                                                                                     |
| F43 | **The base is large.** A first request with "Reply with OK only" holds 43k tokens in the probe, and 55.4k in the app (the three sessions in `.data/agents.db`). The app adds the rule, the `chat` plugin and the `chat` MCP tools. The user's settings give most of the base: rules (33 KB), the skill list (37 KB), the `SessionStart` hook output (17 KB).                                                                                                                                                                                             |
| F44 | **Lean flags cut the base.** `--setting-sources project`: 20k, start in 0.19 s. `--system-prompt <text>` (replace): 40k. Both: 17k. `--strict-mcp-config` added nothing more here. `--exclude-dynamic-system-prompt-sections` shared only 1.6k more cache between two folders.                                                                                                                                                                                                                                                                           |
| F45 | **A fresh session in the same folder can read the whole base from the cache.** Same folder, same appended text, within the hour: `cw 0, cr 43k`, 0.0004 USD, against 0.0062 USD in a new folder (`cw 30k, cr 13k`). A change of folder or of the appended text breaks the cache after the first 13k.                                                                                                                                                                                                                                                     |
| F46 | **A resume within the hour writes part of the base again.** `cw 16k, cr 27k`, 0.0097 USD for a one-word answer.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F47 | **An idle process costs memory, not money.** It answers `initialize` in 0.65 s to 0.85 s, and holds about 460 MB with its child processes (the user's MCP servers). With `--setting-sources project`, it starts in 0.2 s.                                                                                                                                                                                                                                                                                                                                |
| F48 | **Auto-memory is on for an agent.** With the user's settings, the agent wrote `memory/release-owner.md` and `MEMORY.md` under `~/.claude/projects/<folder>/`. That memory belongs to the folder, not to the session. So it stays after a new session, and the agents of one channel folder share it.                                                                                                                                                                                                                                                     |

### What a wake costs

Let `C` be the context of the agent when it sleeps, `B` the base (55k in the
app), and `S` a summary (2k to 5k). The cost is in units of one cache read
(Haiku: 0.01 USD for each million tokens). A cold cache is a wake after more
than one hour.

```
Wake after more than 1 hour, first request only

C = 150k  resume as it is       ████████████████████████████████  20·C     = 3,000k
          compact at sleep*     ██████████▋                       measured ≈ 1,000k
          ... then resume cold  ████████████▊                     20·(B+S) = 1,200k
          fresh, base warm (F45)█▋                                B+20·S   =   155k
C =  60k  resume as it is       ████████████▊                     20·C     = 1,200k

* 0.009 to 0.011 USD for each compaction of 43k to 53k on Haiku (F40).
  A larger context costs more to compact. This is not measured.
```

So a compaction at sleep pays for itself only for a large context, or when
many turns follow the wake. This is the reason for `compactAboveTokens`.

Each later request of a turn reads the whole context again (`tools.jsonl`
read 308k tokens in one turn of 8 requests). So a smaller context also makes
each turn after the wake cheaper, not only the first request.

## The model: two memories

An agent that wakes needs two things. They come from two places.

```
                    ┌──────────────────────────────────────────┐
  What the agent    │ 1. Its own memory                         │  Claude session
  did and learned   │    files it read, decisions, tool results │  (transcript),
                    │    → compacted at sleep (F40)             │  auto-memory (F48)
                    └──────────────────────────────────────────┘
                    ┌──────────────────────────────────────────┐
  What the others   │ 2. The conversation it missed             │  our store
  said while it     │    messages since its last turn           │  (timeline_items)
  slept             │    → the last N verbatim, older ones as a │
                    │      summary or a pointer                 │
                    └──────────────────────────────────────────┘
```

A DM needs only the first memory, because the user is the only other author.
A busy channel needs both.

## Proposed lifecycle

```
                   message
   ┌──────────┐ ─────────────▶ ┌───────────────────────────────┐
   │  asleep  │                │ awake (process live)          │
   │ no       │                │  starting → idle ⇄ busy/waiting│
   │ process, │                └──────────────┬────────────────┘
   │ Claude   │                               │ idle, queue empty,
   │ session  │                               │ no open card, no running
   │ kept     │                               │ background task
   └──────────┘                               ▼
        ▲                          sleep timer (sleepAfterMinutes)
        │                                     │ fires
        │                                     ▼
        │                          context ≥ compactAboveTokens?
        │                            │yes                 │no
        │                            ▼                    │
        │                    prompt "/compact <ours>"     │
        │                    → compaction item (F40, F41) │
        │                            │                    │
        └──────────── stop(), end reason "sleep" ◀────────┘
```

A message, a mention, a `send_message` from another agent, or Restart wakes
the agent. Each one goes through `liveSessionFor()`, as today.

### The wake

```
liveSessionFor(agent, conversation)
  ├─ live process? → use it (no change)
  └─ no live process
       ├─ latest row has a Claude session ID → start with --resume <id>
       │     └─ the process fails with "No conversation found" (F30 shape)?
       │           → fallback: new row, --session-id <new uuid>,
       │             brief = last compaction summary + the wake prompt
       └─ no ID → --session-id <new uuid> (no change)

promptFor(agent, conversation)       the wake prompt, see below
```

### The wake prompt

The server builds the prompt. Only the parts that apply go in.

```
[Chat app] You were asleep for 3 h 12 min.                     ← gap > 1 h only
[Chat app] Changes since your session started:                 ← facts changed
- Members now: User, reviewer-bot, test-runner (you), docs-bot.
- You now work in ~/code/release-v3.
[Chat app] 212 messages came while you were asleep.            ← missed > limit
Summary of the first 182 (made by the chat app): …             ← option D only
Use read_messages for their full text.
[User] @test-runner …                                          ← the last 30, as today
[reviewer-bot] …
```

The `[Author] text` lines keep the shape of `docs/conversations.md`. So the
agent reads the prompt in the way that the rule already tells it.

## Configuration

| Setting              | Where                                | Default | Why this default                                                                                                                                   |
| -------------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sleepAfterMinutes`  | The agent form. Empty: the app value | —       |                                                                                                                                                    |
| App value            | `AGENTS_SLEEP_AFTER_MINUTES`         | 15      | Frees 460 MB (F47). A wake within the hour costs about 0.01 USD on Haiku (F46). Under 60, so that the compaction at sleep reads a warm cache (F39) |
| Never sleep          | `sleepAfterMinutes: 0`               |         | For an agent that must answer at once, or that keeps a background job                                                                              |
| `compactAboveTokens` | `AGENTS_COMPACT_ABOVE_TOKENS`        | 100,000 | The base is 55k (F43), and compaction cannot go below it (F42). Under about 100k, compaction saves little                                          |
| Missed-message limit | `AGENTS_WAKE_MESSAGES`               | 30      | About the size of one screen of the chat. Older messages go to a summary or a pointer                                                              |

The form validates `sleepAfterMinutes` with the Zod schema, the same as
`maxTurns`: a whole number from 0 to 55, or empty. The server keeps one timer
for each live session, in memory. A server start needs no timer, because no
process is alive after it.

## System prompt options

We control the command line, so we have these levers. Each one is measured
unless the row says otherwise.

| Lever                                      | What it does                                                                                   | Use it?                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--append-system-prompt` (today)           | Adds our rule after the default prompt. Recorded at the first request (F38)                    | Yes, for the **static** rule only                                                                                                                      |
| Facts in the prompt, not the system prompt | The "This session" block goes into the first prompt of each process, and again when it changes | **Recommended.** It fixes F38, and the system prompt of one agent is then the same in each conversation, so its cache is shared (F45)                  |
| `--system-prompt-snapshot off`             | Builds the system prompt again at each request                                                 | No. It fixes F38, but each change breaks the cache. The cost of the dynamic sections at each request is not measured                                   |
| `--system-prompt <text>` (replace)         | Drops the default prompt of Claude Code                                                        | No. It saves 3k only (F44), and the agent loses the guidance for its tools                                                                             |
| `--setting-sources project`                | Drops the user's rules, skills, hooks and MCP servers                                          | Not for agents, because of decision F23 in `docs/architecture.md`. Yes for a summarizer process (option D). A "lean" agent profile is an open question |
| `--exclude-dynamic-system-prompt-sections` | Moves the folder and git facts into the first message                                          | No. It gained 1.6k only (F44)                                                                                                                          |
| `/compact <instructions>`                  | Our instructions for the summary                                                               | Yes, at sleep (F40)                                                                                                                                    |
| `--autocompact <tokens>`                   | Sets the window for automatic compaction (100k to 1M)                                          | Maybe, as a second limit for an agent that never sleeps. Not measured                                                                                  |
| `--settings` with a `SessionStart` hook    | Can add context at resume or after compaction                                                  | No. The prompt does the same with no hook. Not measured                                                                                                |
| `--fork-session`                           | Resumes into a new Claude session ID                                                           | Not now. It can copy the memory of an agent into a new conversation later. Not measured                                                                |

The instructions for `/compact` go in `agent/compact.md`, next to
`agent/environment.md`, for example:

```
Keep: the task that is open, who asked for it, the decisions and their
reasons, the files that you changed, and each promise that you made to the
user or to another agent. Drop: tool output that you can read again.
```

## Data flows

### Sleep

```
result → state idle → deliverNext(): queue empty
  → arm timer(sleepAfterMinutes)              any prompt, answer or task disarms it
timer fires
  → guard: idle, queue empty, no open request, no running task (F11)
  → contextTokens ≥ compactAboveTokens?       from the last assistant usage, in memory
       yes → handle.prompt("/compact " + compact.md)
             stdout: compact_boundary + summary user line
             reducer → item { kind: "compaction", preTokens, postTokens, summary }
             result → idle
  → endReason = "sleep" → handle.stop() → exited
  → publish agent_state
```

### Wake

```
POST message → addressedAgents → prompt(agentId)
  → liveSessionFor: no live process → start(row, --resume)
  → promptFor: wakeHeader(gap, facts changed, missed count)
              + summary or pointer for the older missed messages
              + the last N messages
  → queue → idle → prompt
```

### What is stored and what is derived

| Value                       | Stored or derived                                                                 |
| --------------------------- | --------------------------------------------------------------------------------- |
| The compaction summary      | Derived: a timeline item from the stored lines. A rebuild makes it again          |
| The end reason of a process | Stored: `agent_sessions.end_reason`                                               |
| The time of the last turn   | Derived: the `createdAt` of the last `turn` item of the agent                     |
| The facts at the start      | Stored: `agent_sessions.config` gets `facts` (members, topic, reply mode, folder) |
| The context size            | In memory: the usage of the last `assistant` line                                 |
| A conversation summary      | Stored: `conversation_summaries` (option D only)                                  |

## ERD

```
agents                                agent_sessions
┌──────────────────────────────┐     ┌────────────────────────────────────┐
│ PK id                        │1   N│ PK id                              │
│    name, model, …            ├────▶│ FK agent_id ─▶ agents ON DELETE    │
│    max_turns                 │     │    CASCADE                         │
│ +  sleep_after_minutes INT   │     │ FK conversation_id ─▶ conversations│
│      NULL = app value,       │     │    ON DELETE CASCADE               │
│      0 = never               │     │    claude_session_id, state, …     │
└──────────────────────────────┘     │    config (JSON) + facts           │
                                     │ +  end_reason TEXT NULL            │
                                     │      sleep | stop | restart | new  │
                                     │      | removed | failed | server   │
                                     └────────────────────────────────────┘
conversations
┌──────────────────────────────┐     conversation_summaries  (option D only)
│ PK id                        │1   N┌────────────────────────────────────┐
│    kind, name, cwd, …        ├────▶│ PK conversation_id, through_seq    │
└──────────────────────────────┘     │ FK conversation_id ─▶ conversations│
                                     │    ON DELETE CASCADE               │
                                     │    text, cost_usd, created_at      │
                                     └────────────────────────────────────┘
```

- `+` marks a new column. `conversation_summaries` is a new table.
- One conversation has N summaries. Each one covers the messages up to its
  `through_seq`. The latest one is the one in use. The older ones show the
  history and cost little.
- Migration 9 adds the two columns. It needs no rebuild of the tables.
  Migration 10 adds the table, only with option D.
- The compaction needs no table. Its item lives in `timeline_items`, as each
  other item.

## The build

In slices, test-first with the `tdd` skill. Each slice ships alone.

1. **Facts in the prompt (fixes F38).** `environmentPrompt()` splits into the
   static rule (system prompt) and `sessionFacts()` (the first prompt of each
   process, and a "Changes since…" block when the stored `facts` differ).
   Correct `docs/agent-environment.md`, which today says that a resume gets
   "the rule of now". Seams: `buildArgs()`, `promptFor()` through the server.
2. **Compaction lines.** Record a fixture `compact.jsonl` with
   `pnpm fixtures:record`. The decoder gets `compact_boundary`, the summary
   `user` line and `system/status`. The reducer makes a `compaction` item.
   The conversation shows it as a divider: "test-runner compacted its memory
   (53k → 16k tokens)". The session card shows the last summary. This also
   covers an automatic compaction (`trigger: "auto"`).
3. **The sleep timer.** `sleep_after_minutes`, `end_reason`, the timer and its
   guards, and the compaction before the stop. The agent page and the
   session card show "Asleep since 14:02" for a latest row with
   `end_reason = "sleep"`. A test drives the clock with fake timers.
4. **The wake prompt.** The gap line, the missed-message limit and the
   pointer to `read_messages`. The fallback to a new Claude session when the
   resume fails.
5. **Option D (if chosen).** A summarizer process with the lean flags (F44),
   `--no-session-persistence` and a fixed system prompt, so each update reads
   its base from the cache.

**Verify.** `pnpm test`, `pnpm lint` and `pnpm build` in the worktree. Then a
live check: one agent, `sleepAfterMinutes: 1`, a context above a low
`compactAboveTokens`, a message after the sleep. Check the compaction item,
the stopped process, and the answer that uses the summary.

## Open questions

1. **Resume or fresh, after a long sleep?** The user asked for a fresh
   session after an idle time. The plan recommends compaction at sleep and a
   resume at wake. The reasons:
   - After a compaction, a cold resume and a fresh session cost the same
     (`20·(B+S)`).
   - A resume keeps the Claude session ID, the session card totals and the
     recent messages that Claude Code preserves (`preserved_segment`).
   - The fresh session stays as the fallback, and as New session.

   The alternative is `freshAfterHours`: a new Claude session when the gap is
   longer, with the stored summary as its brief. It gives a clean transcript,
   but the session card starts again from zero.

2. **Where does the user set the idle time?** The plan proposes the agent
   form, with an app value. A channel setting is also possible, so one agent
   sleeps fast in a quiet channel and stays awake in a busy one.
3. **The missed messages: option C or option D?** C is the last 30 messages
   and a pointer to `read_messages`, at no cost. D adds a summary of the older
   ones from a lean Haiku process, shared by each agent of the conversation.
   The plan recommends C first, and D only if agents miss context in
   practice.
4. **A lean profile for agents?** `--setting-sources project` cuts the base
   from 43k to 20k (F44), but the agent loses the user's rules, skills, hooks
   and MCP servers. It is against F23, so it needs a decision of its own.
5. **The user's hooks at compaction.** The user's `PreCompact` hook ran in
   each probe (F40). A sleep compaction runs it for each agent. Accept it, or
   pass a setting that turns it off for agents?
6. **Old transcripts.** Claude Code can delete old transcripts after a
   number of days. This is not measured. If it happens, the resume fails, and
   slice 4 starts a new session with the stored summary. Measure the period
   before the build.

## Not measured

- A wake after more than one hour. F39 gives the TTL, and the costs above
  come from the measured prices, not from a probe that waited.
- An automatic compaction at the window, and `--autocompact`.
- `--system-prompt-snapshot off` over many requests.
- The deletion of old transcripts by Claude Code.
