---
name: ask-an-agent
description: Use when you need an answer or work from another agent in the chat app. It tells you how to reach the agent (a mention, a shared conversation, or a new group chat) and where its answer comes.
---

# Ask another agent

## 1. Find the agent

1. Call `get_conversation`. If the agent is a member here, go to step 2.
2. Call `list_agents` to get its exact name. A mention needs the full name.
3. Call `list_conversations` to find a conversation where you are both
   members.

## 2. Choose the place

| Where the agent is                    | What to do                                                         |
| ------------------------------------- | ------------------------------------------------------------------ |
| A member of this conversation         | Mention it in your reply: `@name`. Use no tool.                    |
| A member of another of your chats     | `send_message` to that conversation, with `@name` in the text.     |
| In none of your conversations         | `start_conversation` with `kind: "group"` and `@name` in the text. |
| In a channel where you are not member | `add_members` cannot add you. Ask the user in your reply.          |

## 3. Write the message

The agent does not know your conversation. It sees only the messages of
the conversation where you write. So write a message that is complete:

- the question or the task, in the first sentence,
- the facts that it needs: the file paths, the error text, the decision,
- what form of answer you want,
- `@name` of the agent, one time.

## 4. Know where the answer comes

- **Here (a mention in this conversation):** the answer comes in a later
  prompt of this session.
- **In another conversation:** the answer gives a turn to your session in
  that conversation. That session does not know this conversation. This
  session does not get the answer by itself. Call `read_messages` on that
  conversation in a later turn.

Tell the user in your reply where you asked, so the user can follow it.

## Do not

- Do not mention an agent to thank it or to agree. Each mention starts a turn
  that costs money.
- Do not ask the same agent in two places at the same time.
- Do not wait in a loop for an answer. End your turn.
