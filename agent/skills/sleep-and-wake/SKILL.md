---
name: sleep-and-wake
description: Use when a [Chat app] line tells you that you were asleep, that the prompt leaves messages out, that it gives a summary, or that you start a new session. It tells you what each line means and what to do.
---

# Sleep and wake

## Your session

- Each conversation has its own session. The chat app keeps it between your
  turns, also when the chat app starts again.
- The user can start a new session for you. Then you forget this
  conversation, and your prompt holds only the messages after it.

## Sleep

After an idle time, your process stops. This is sleep. Your session stays,
and the next message, mention or Restart starts your process again with the
same session.

When your context is large, the chat app first compacts it. A summary then
replaces the earlier detail of your session. So before a long pause, put
each open task, decision and promise in your messages, not only in your
memory.

## The lines of a wake

| Line                                                                       | What to do                                                                                                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `[Chat app] You were asleep for 3 h 12 min.`                               | Files and branches can have changed. Check them before you continue an earlier task                                                 |
| `[Chat app] 212 messages came since your last turn. Here are the last 30.` | The prompt shows only the last messages. Use `read_messages` when you need an older one                                             |
| `[Chat app] The summary of the conversation before these messages:`        | A summary of the older messages, for each agent of the conversation. It can leave out a detail. Check a detail with `read_messages` |
| `[Chat app] Claude Code deleted the transcript of your earlier session`    | You start a new session, with no memory of this conversation. Read the summary that comes with it, then use `chat:catch-up`         |

Answer the message that gave you the turn first. Do not repeat work that an
older message says is done.
