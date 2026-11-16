# Long-lived agents: sleep, wake and memory

**Status:** awaiting go-ahead to build. The measurements are done
(2026-11-16, Claude Code 2.1.311, Haiku 5.5, about 0.57 USD, of which one
probe took 0.28 USD: F50). All the questions are decided (decisions 1–8).
Nothing is open.

An agent can stay in a DM, a group chat or a channel for weeks. Today, its
`claude` process never stops on its own, and its Claude session grows until
Claude Code compacts it. This plan gives the agent a sleep and a wake:

- **Sleep.** After an idle time that the user sets, the server stops the
  process. If the context is large, the server first compacts it.
- **Wake.** The next message starts the process again with `--resume`. The
  prompt tells the agent what it missed, in a size that has a limit.

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

## Decisions

1. **Compaction at sleep, then resume at wake.** After a compaction, a cold
   resume and a fresh session cost the same (`20·(B+S)`, see "What a wake
   costs"). A resume keeps the Claude session ID, the totals of the session
   card, and the recent messages that Claude Code keeps
   (`preserved_segment`). A fresh session is the fallback when a resume
   fails, and New session stays the way to forget. Rejected:
   `freshAfterHours`, a new Claude session after a long gap. It gives a
   clean transcript, but the session card starts again from zero.
2. **The idle time is a setting of the agent and of the channel.** The order
   is the same as for the folder (`docs/agents.md`): the channel, then the
   agent, then the app value. A DM and a group chat have no settings, so
   there the agent wins. So one agent can sleep fast in a quiet channel and
   stay awake in a busy one.
3. **The wake prompt holds the last 30 messages and a conversation
   summary.** A lean Haiku process writes one rolling summary for each
   conversation, and each agent of that conversation reads it. Older
   messages stay available through `read_messages`.
4. **No lean profile.** Each agent keeps the user's settings, rules, skills,
   hooks and MCP servers (decision F23 in `docs/architecture.md`). The plan
   uses progressive disclosure to keep the base small (see "Progressive
   disclosure").
5. **Facts go in the prompt, not in the system prompt.** This fixes F38. The
   system prompt holds only what never changes.
6. **The user's hooks run at compaction, and each agent process gets
   `AGENT_CHAT=1`.** Options A and C of "The user's hooks at compaction". A
   hook script of the user can test the variable and skip its work in an
   agent. Rejected: `disableAllHooks`, because it also stops the safety
   hooks.
7. **No plugins for each agent now.** Each agent gets the plugins of the
   user. `--settings enabledPlugins` stays a later option (F49).
8. **Claude Code deletes an agent transcript 30 days after its last turn,
   and the app accepts this.** A wake after a longer sleep takes the
   fallback: a new Claude session, with the last compaction summary and the
   wake prompt. Both live in our database, so the sweep cannot delete them
   (F53–F55). Rejected: `--settings '{"cleanupPeriodDays": …}'` for agent
   processes. The sweep is shared, so the value of one agent process decides
   the retention of each transcript of the user on that day. Also rejected:
   a touch of each transcript to keep it young. `docs/agents.md` tells the
   user that `cleanupPeriodDays` in the user settings sets this limit.

## Measurements

The probes used the stream-json flags of the app, `--setting-sources
user,project`, and Haiku. "Context" is the context of the first request:
input, cache write (`cw`) and cache read (`cr`). When the plan ships, these
findings move into `docs/protocol.md`.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F38 | **A resume keeps the system prompt of the first request.** `--system-prompt-snapshot` is `on` by default. A first process had `--append-system-prompt "The codeword is ALPHA."`. A `--resume` with "BETA" answered `ALPHA`. With `--system-prompt-snapshot off` on both processes, it answered `BETA`. The help says that the snapshot stays "until the conversation is compacted".                                                                                                                                                                                                             |
| F39 | **The prompt cache lives one hour.** Each cache write is `ephemeral_1h_input_tokens`. A cache write costs 20 times a cache read (Haiku: 0.20 against 0.01 USD for each million tokens, from the measured costs).                                                                                                                                                                                                                                                                                                                                                                                |
| F40 | **`/compact <instructions>` works as a stream-json prompt.** The turn writes `system/status` (`"compacting"`), `system/hook_started` and `hook_response` lines of `SessionStart:compact`, `system/init`, `system/compact_boundary` with `compact_metadata` (`trigger: "manual"`, `pre_tokens`, `post_tokens`, `preserved_segment`), a `user` line whose `content` is a string (the summary), a replayed `user` line with `<local-command-stdout>`, and `result/success` with no text. No `assistant` line comes. 43k → 17k tokens in 4.3 s for 0.009 USD, and 53k → 16k in 6.7 s for 0.011 USD. |
| F41 | **The summary text is on stdout.** The `user` line after `compact_boundary` starts with "This session is being continued from a previous conversation…" and holds the summary in Claude Code's own sections. The decoder of today makes it `unknown`.                                                                                                                                                                                                                                                                                                                                           |
| F42 | **Compaction cannot go below the base.** After `/compact`, Claude Code attaches the skill list, the deferred tools, the MCP instructions and the hook output again. A small session went from 43k to 55k tokens at its next request.                                                                                                                                                                                                                                                                                                                                                            |
| F43 | **The base depends on the model.** "Reply with OK only" with the user's settings: 43.2k on Haiku, 45.4k with the `chat` plugin and our rule. The three real sessions in `.data/agents.db` ran on Sonnet 5.5, and their first request held 55.4k. So `B` is about 45k on Haiku and 55k on Sonnet.                                                                                                                                                                                                                                                                                                |
| F44 | **Lean flags cut the base, but the agent loses its environment.** `--setting-sources project`: 20k, start in 0.19 s. `--system-prompt <text>` (replace): 40k. Both: 17k. `--exclude-dynamic-system-prompt-sections` shared only 1.6k more cache between two folders.                                                                                                                                                                                                                                                                                                                            |
| F45 | **A fresh session in the same folder can read the whole base from the cache.** Same folder, same appended text, within the hour: `cw 0, cr 43k`, 0.0004 USD, against 0.0062 USD in a new folder (`cw 30k, cr 13k`). A change of folder or of the appended text breaks the cache after the first 13k.                                                                                                                                                                                                                                                                                            |
| F46 | **A resume within the hour writes part of the base again.** `cw 16k, cr 27k`, 0.0097 USD for a one-word answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F47 | **An idle process costs memory, not money.** It answers `initialize` in 0.65 s to 0.85 s, and holds about 460 MB with its child processes (the user's MCP servers).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F48 | **Auto-memory is on for an agent.** With the user's settings, the agent wrote `memory/release-owner.md` and `MEMORY.md` under `~/.claude/projects/<folder>/`. That memory belongs to the folder, not to the session. So it stays after a new session, and the agents of one channel folder share it.                                                                                                                                                                                                                                                                                            |
| F49 | **The parts of the base (Haiku, each one removed alone).** `--disable-slash-commands`: −5.0k (the skill list). `disableAllHooks`: −3.4k (hook output). Both user plugins off with `--settings enabledPlugins`: −3.9k. `--strict-mcp-config`: −0.2k (the MCP tools are deferred, so only their names are in the context). `--plugin-dir agent`: +0.02k. Our rule: +2.1k.                                                                                                                                                                                                                         |
| F50 | **A tool list with no `ToolSearch` loads each MCP schema.** `--tools Read` gave a first request of 280k tokens and cost 0.28 USD for "OK". Deferred tools keep about 240k tokens of the user's MCP schemas out of each agent.                                                                                                                                                                                                                                                                                                                                                                   |
| F51 | **The `SessionStart` hooks run again after each compaction.** Five hooks ran as `SessionStart:compact`. Two wrote output (8.4 KB and 0.4 KB), and that output goes back into the context: `post_tokens` was 17.7k with hooks and 12.1k with `disableAllHooks`.                                                                                                                                                                                                                                                                                                                                  |
| F52 | **A `PreCompact` hook sends no hook line, and `--settings` cannot remove it.** Only the replayed line `<local-command-stdout>Compacted PreCompact [bd prime] completed successfully</local-command-stdout>` names it. With `--settings '{"hooks":{"PreCompact":[]}}'`, `bd prime` still ran: the hooks of `--settings` add to the user's hooks. Only `disableAllHooks: true` stops them, and it stops each hook of each event.                                                                                                                                                                  |
| F53 | **A daily sweep deletes each transcript that is older than `cleanupPeriodDays`.** The default is 30 days, and the user does not set it. The sweep looks at the file time, and each turn writes to the file, so the days count from the last turn. It runs at most once in 24 hours for each config folder (the file `.last-cleanup`), in any process, also in `-p`, about 5 s after the start. In an empty `CLAUDE_CONFIG_DIR`, it deleted copies of 40 and 31 days and kept a copy of 29 days.                                                                                                 |
| F54 | **Only the transcripts of the desktop app are exempt.** In `~/.claude/projects`, each transcript older than 30 days has `entrypoint: "claude-desktop"` (331 files). No `cli` or `sdk-cli` transcript older than 30 days is left. An agent process writes `entrypoint: "sdk-cli"`, so its transcript is not exempt. One turn wrote a transcript of 385 KB (the skill list, the rules and the prompt snapshots).                                                                                                                                                                                  |
| F55 | **`--settings` changes the period for the sweep of that process only.** With `{"cleanupPeriodDays": 3650}`, the sweep kept a copy of 40 days. But the first process of each 24 hours, from the terminal, the desktop app or an agent, does the sweep with its own value. A `--resume` of a deleted transcript fails as in F30: stderr "No conversation found with session ID", no answer to `initialize`.                                                                                                                                                                                       |

### What a wake costs

Let `C` be the context of the agent when it sleeps, `B` the base (F43), and
`S` a summary (2k to 5k). The cost is in units of one cache read (Haiku:
0.01 USD for each million tokens). A cold cache is a wake after more than
one hour. The chart uses `B = 55k`.

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
  said while it     │    messages since its last turn           │  (timeline_items,
  slept             │    → the last 30 verbatim, older ones in  │  conversation_
                    │      the conversation summary             │  summaries)
                    └──────────────────────────────────────────┘
```

A DM needs only the first memory, because the user is the only other author.
A busy channel needs both.

## The lifecycle

```
                   message
   ┌──────────┐ ─────────────▶ ┌────────────────────────────────┐
   │  asleep  │                │ awake (process live)           │
   │ no       │                │  starting → idle ⇄ busy/waiting│
   │ process, │                └──────────────┬─────────────────┘
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
       │     └─ the process fails with "No conversation found" (F30, F55)?
       │        always after 30 days with no turn (F53)
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
[Chat app] 212 messages came while you were asleep.            ← missed > 30
Summary of the conversation up to the last 30 messages: …      ← conversation summary
Use read_messages for the full text of older messages.
[User] @test-runner …                                          ← the last 30, as today
[reviewer-bot] …
```

The `[Author] text` lines keep the shape of `docs/conversations.md`. So the
agent reads the prompt in the way that the rule already tells it.

### The conversation summary

```
wake of agent A, 212 missed messages
  → cut = the seq of the 30th message from the end
  → latest summary covers up to through_seq ≥ cut? → use it
  → else: summarizer process (one shot)
       input:  the latest summary + the messages after its through_seq, up to cut
       output: the new summary, stored with through_seq = cut
       on failure or after 30 s: no summary, the pointer to read_messages only
  → the wake prompt
```

- One summary covers each conversation. Agent B, which wakes later, uses
  the same summary if it covers B's cut, so the summarizer runs once.
- The summary covers messages that the agent already saw too. It is a recap,
  so this does no harm, and one shared summary is simpler than one for each
  agent.
- The summarizer is not an agent. It reads only the text of the messages,
  with no tools, so the lean flags of F44 apply here and nowhere else:
  `--setting-sources project --strict-mcp-config --tools "" --model haiku
--no-session-persistence --system-prompt <agent/summarize.md>`, in the
  scratch folder. Its fixed system prompt lets each run read its base from
  the cache. `--tools ""` with no MCP server cannot hit F50, but measure it in
  slice 5.
- Estimate: a base of about 17k (F44) and 200 messages of about 60 tokens
  each, so about 0.003 USD on Haiku for each update. Not measured.

## Progressive disclosure

The user wants each agent to know its environment and its tools. Claude Code
already discloses most of them in layers. Our part of the base is 2.1k of
45k (F49).

```
L0  always in the context, in full                         ≈ 45k (Haiku)
    Claude Code prompt and built-in tool schemas              ~25k  (estimate)
    the user's rules and CLAUDE.md (33 KB)                    ~8k   (estimate)
    hook output at start (SessionStart)                       3.4k  (F49)
    our rule, agent/environment.md                            2.1k  (F49)

L1  a name and one line for each item; the body loads on use
    skills and commands, also chat:*                          5.0k  (F49)
    MCP tools, deferred                                       0.2k  (F49)
    subagent types                                            ~1k   (estimate)

L2  only on demand, through a tool or a skill
    skill bodies (chat:ask-an-agent, chat:hand-off, chat:catch-up)
    MCP schemas, through ToolSearch                           ~240k kept out (F50)
    read_messages, get_conversation, list_agents

L3  in the prompt, only when it changes
    session facts, wake header, conversation summary, missed messages
```

What the plan does with this:

1. **Keep `ToolSearch`.** The app never passes `--tools`. The agent schema
   refuses a `disallowedTools` entry that names `ToolSearch`, because one
   such entry puts about 240k tokens into each request of that agent (F50).
2. **Move the facts from L0 to L3.** Decision 5. The agent learns each fact
   when it changes, and the rest of L0 stays the same, so the cache holds it.
3. **Make our rule a map.** L0 keeps what applies to each message: the shape
   of a message, mentions, and the shape of a question. Each procedure moves
   to a `chat:` skill in L1, with one line in the rule that says when to use
   it. For example, "Sessions and memory" becomes the skill
   `chat:sleep-and-wake`, which explains the wake prompt and the summary.
   This saves at most 1.5k now. The real gain: the rule can grow by a skill
   and not by L0.
4. **The base matters only on a cold cache.** On a warm cache, L0 costs 0.1
   of its size. On a cold cache, it costs 20 times. So the sleep and the
   wake save much more than a smaller L0.

Two levers are the user's, not the app's, so the plan does not use them:

- A rule file with `paths` in its front matter loads only when the agent
  works on files that match. Not measured.
- Plugins for each agent. See question 2.

## The user's hooks at compaction

A sleep compaction runs the user's hooks, the same as each compaction that
Claude Code starts on its own.

```
sleep timer fires → prompt "/compact <agent/compact.md>"
  1. PreCompact hooks        bd prime (user settings)             F52
                             no hook line, one stdout line names it
  2. the summary request     the model reads the context, writes the summary
  3. SessionStart:compact    5 hooks (user settings and plugins)  F51
                             2 write output (8.4 KB and 0.4 KB),
                             and it goes back into the context
  4. compact_boundary, the summary line, result
then stop()
wake → --resume → SessionStart:resume hooks, as at each resume today
```

What this means:

- **Each sleep with a compaction runs `bd prime` once for that agent, in the
  folder of that agent.** In a channel with five agents, it can run five
  times in the same folder. I did not read what `bd prime` does. If it only
  prints context, the cost is its output and some time. If it writes files,
  each agent writes them.
- **The hook output stays in the context after the compaction.** It is part
  of the floor of F42: 5.6k tokens in the probe (F51).
- **The hooks already run today.** `SessionStart` runs at each process start
  and each resume, and `PreToolUse` runs at each tool call of each agent. A
  sleep adds one `PreCompact` and one `SessionStart:compact`, and the wake
  adds one `SessionStart:resume`.
- **The app cannot turn off one event.** `--settings` adds hooks and does not
  remove them (F52). `disableAllHooks` also turns off the `PreToolUse`
  guards and the `SessionStart` context, so the agent loses part of its
  environment. That is against decision 4.

The options:

| Option                          | Result                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Accept                       | No work. The hooks run as in a terminal session that compacts                                                                                                                                  |
| B. `disableAllHooks` for agents | Rejected: the agent loses the safety hooks and the context hooks                                                                                                                               |
| C. A mark in the environment    | The server sets `AGENT_CHAT=1` for each agent process. A hook script of the user can test it and skip its work. The user decides for each hook. That a hook gets this variable is not measured |
| D. No compaction at sleep       | No hook runs at sleep, but each cold wake costs `20·C` (see the chart)                                                                                                                         |

Decided: A and C together (decision 6).

## Configuration

| Setting              | Where                                                      | Default | Why this default                                                                                                                                   |
| -------------------- | ---------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sleepAfterMinutes`  | Channel settings, then the agent form. Empty: the next one | —       | Decision 2                                                                                                                                         |
| App value            | `AGENTS_SLEEP_AFTER_MINUTES`                               | 15      | Frees 460 MB (F47). A wake within the hour costs about 0.01 USD on Haiku (F46). Under 60, so that the compaction at sleep reads a warm cache (F39) |
| Never sleep          | `sleepAfterMinutes: 0`                                     |         | For an agent that must answer at once, or that keeps a background job                                                                              |
| `compactAboveTokens` | `AGENTS_COMPACT_ABOVE_TOKENS`                              | 100,000 | The base is 45k to 55k (F43), and compaction cannot go below it (F42). Under about 100k, compaction saves little                                   |
| Missed-message limit | `AGENTS_WAKE_MESSAGES`                                     | 30      | About the size of one screen of the chat. Older messages go into the conversation summary                                                          |

Both forms validate `sleepAfterMinutes` with the Zod schemas in
`server/schemas.ts`, the same as `maxTurns`: a whole number from 0 to 55, or
empty. The server keeps one timer for each live session, in memory. A server
start needs no timer, because no process is alive after it.

## System prompt options

We control the command line, so we have these levers. Each one is measured
unless the row says otherwise.

| Lever                                      | What it does                                                                                   | Use it?                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--append-system-prompt` (today)           | Adds our rule after the default prompt. Recorded at the first request (F38)                    | Yes, for the **static** rule only                                                                                                      |
| Facts in the prompt, not the system prompt | The "This session" block goes into the first prompt of each process, and again when it changes | Yes (decision 5). It fixes F38, and the system prompt of one agent is then the same in each conversation, so its cache is shared (F45) |
| `--system-prompt-snapshot off`             | Builds the system prompt again at each request                                                 | No. It fixes F38, but each change breaks the cache. The cost of the dynamic sections at each request is not measured                   |
| `--system-prompt <text>` (replace)         | Drops the default prompt of Claude Code                                                        | Only for the summarizer. For an agent it saves 3k only (F44), and the agent loses the guidance for its tools                           |
| `--setting-sources project`                | Drops the user's rules, skills, hooks and MCP servers                                          | Only for the summarizer (decision 4)                                                                                                   |
| `--tools <list>`                           | Sets the built-in tools                                                                        | Only for the summarizer, with `--tools ""`. Never for an agent (F50)                                                                   |
| `--disable-slash-commands`                 | Drops each skill and command                                                                   | No. It saves 5.0k (F49), but the agent loses its skills, also `chat:*`                                                                 |
| `--settings '{"enabledPlugins":…}'`        | Turns off a plugin for one process                                                             | Maybe, see question 2. Both user plugins off: −3.9k (F49)                                                                              |
| `--settings '{"disableAllHooks":true}'`    | Turns off each hook                                                                            | No (see "The user's hooks at compaction")                                                                                              |
| `--exclude-dynamic-system-prompt-sections` | Moves the folder and git facts into the first message                                          | No. It gained 1.6k only (F44)                                                                                                          |
| `/compact <instructions>`                  | Our instructions for the summary                                                               | Yes, at sleep (F40)                                                                                                                    |
| `--autocompact <tokens>`                   | Sets the window for automatic compaction (100k to 1M)                                          | Maybe, as a second limit for an agent that never sleeps. Not measured                                                                  |
| `--fork-session`                           | Resumes into a new Claude session ID                                                           | Not now. It can copy the memory of an agent into a new conversation later. Not measured                                                |

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
              + conversationSummary(cut)          may start the summarizer
              + the last 30 messages
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
| The conversation summary    | Stored: `conversation_summaries`                                                  |

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
                                     └──────────────────┬─────────────────┘
conversations                                           │ N
┌──────────────────────────────┐1                       │
│ PK id                        ├────────────────────────┘
│    kind, name, cwd, …        │
│ +  sleep_after_minutes INT   │1   N  conversation_summaries  (new)
│      NULL = the agent value, ├────▶┌────────────────────────────────────┐
│      channel only            │     │ PK conversation_id, through_seq    │
└──────────────────────────────┘     │ FK conversation_id ─▶ conversations│
                                     │    ON DELETE CASCADE               │
                                     │    text, cost_usd, created_at      │
                                     └────────────────────────────────────┘
```

- `+` marks a new column. `conversation_summaries` is a new table.
- One conversation has N summaries. Each one covers the messages up to its
  `through_seq`. The latest one is the one in use. The older ones show the
  history and cost little.
- Migration 9 adds the three columns and the table. It needs no rebuild of
  a table.
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
3. **The sleep timer.** `sleep_after_minutes` on the agent and the channel,
   `end_reason`, the timer and its guards, the compaction before the stop,
   and `AGENT_CHAT=1` in the environment of each agent process. The agent
   page and the session card show "Asleep since 14:02" for a latest row with
   `end_reason = "sleep"`. A test drives the clock with fake timers.
4. **The wake prompt.** The gap line, the facts block, the limit of 30
   messages and the pointer to `read_messages`. The fallback to a new Claude
   session when the resume fails. After 30 days with no turn, this is the
   normal path (decision 8), so a test drives it with a session that exits
   as in F30: code 1, the stderr line, and no answer to `initialize`. Add
   `cleanupPeriodDays` to `docs/agents.md`.
5. **The conversation summary.** `conversation_summaries`, the summarizer
   process with its own fixture, and the summary in the wake prompt.
6. **The rule as a map.** The guard for `ToolSearch` in the agent schema.
   Move each procedure of `agent/environment.md` into a `chat:` skill, and add
   `chat:sleep-and-wake`.

**Verify.** `pnpm test`, `pnpm lint` and `pnpm build` in the worktree. Then a
live check: one agent, `sleepAfterMinutes: 1`, a context above a low
`compactAboveTokens`, a message after the sleep. Check the compaction item,
the stopped process, and the answer that uses the summary.

## Open questions

None.

## Resolved

- Resume or fresh after a long sleep: resume (decision 1).
- Where the user sets the idle time: on the channel and on the agent
  (decision 2).
- Option C or option D for missed messages: both (decision 3).
- A lean profile: no (decision 4).
- The user's hooks at compaction: options A and C (decision 6).
- Plugins for each agent: not now (decision 7).
- Old transcripts: measured, 30 days after the last turn, and the app takes
  the fallback (decision 8).

## Not measured

- A wake after more than one hour. F39 gives the TTL, and the costs above
  come from the measured prices, not from a probe that waited.
- An automatic compaction at the window, and `--autocompact`.
- `--system-prompt-snapshot off` over many requests.
- The summarizer with `--tools ""`, and its cost.
- A `PreCompact` hook that fails, and whether it stops the compaction.
- That a hook gets `AGENT_CHAT` from the environment of the process.
