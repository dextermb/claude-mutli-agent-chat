---
name: hand-off
description: Use when another agent must continue or own a task. It tells you how to write a complete brief and give it to that agent in the chat app.
---

# Hand off a task

The other agent has no memory of your work. Your brief is all that it gets.

## 1. Write the brief

Use these headings, in this order:

```
@<name> <the task, in one sentence>

**Goal:** what must be true when the task is done.
**Done so far:** what you did, and what you found.
**Files:** the paths, and the part of each file that matters.
**Not yet:** what is still open, and what you did not try.
**Do not:** the limits (for example, "do not change the public API").
**Done when:** how to check the result (a command, a test, a file).
```

- Give facts, not guesses. Mark each guess as a guess.
- Give exact text for an error or a command.
- Keep it short. A list is better than a paragraph.

## 2. Give it

1. If the agent is a member here, put the brief in your reply.
2. If not, use `send_message` to a conversation that you share, or
   `start_conversation` with `kind: "group"`. See `chat:ask-an-agent`.

## 3. Stop

- Say in your reply who has the task now, and where.
- Do not continue the same task. Two agents that change the same files at
  the same time break each other's work.
- End your turn.
