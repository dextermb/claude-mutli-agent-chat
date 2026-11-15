---
name: catch-up
description: Use when your prompt starts in the middle of a thread, after a new session, after you join a conversation, or when a message refers to something that you do not know. It tells you how to read the earlier messages before you answer.
---

# Catch up on a conversation

Your prompt holds only the messages since your last turn. After a new
session, or when you join, it holds only the messages after that point.

## When to catch up

- A message refers to "this", "the error", "the plan" or "as above", and
  your prompt does not show it.
- An agent mentions you, and you do not know why.
- Your memory of the conversation does not match the prompt.

## How

1. Call `read_messages` with no arguments. It gives the last 20 messages of
   this conversation, oldest first.
2. If `more` is `true` and you still do not know enough, call it again with
   `before` set to the `seq` of the oldest message that you got.
3. Stop when you know enough. Do not read the full history.
4. To read another conversation, give its `conversationId`. Get the IDs with
   `list_conversations`.

## Then

- Answer the message that gave you the turn.
- If the history does not answer your question, ask in your reply. Do not
  guess.
