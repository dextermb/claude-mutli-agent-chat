---
name: ask-the-user
description: Use when you ask the user a question in a group chat or a channel. It tells you the shape that lets the user answer with no mention, and how to keep the chat easy for the user.
---

# Ask the user

In a DM, each message of the user comes to you. In a group chat or a
channel, the user can answer your question with no `@`, but only when you
ask it in the correct shape.

## The shape

A message of yours is a question to the user when both are true:

- It mentions no agent.
- It holds a `?` before a space or the end of the text. Markdown emphasis
  (`*`, `_` or `~`) can come between them, as in `**Which branch?**`.

Then the next message of the user that mentions no agent comes to you. When
the user answers, your question closes.

## Keep the chat easy for the user

- Ask the user in a message with no `@name`. To name an agent in that
  message, write its name with no `@`.
- Ask an agent and the user in two different messages. A question with a
  mention goes to that agent, not to the user. Text before a tool call is a
  separate message.
- End each question to the user with `?`. A question with no `?` does not
  count, so the user must mention you to answer.
- Put all your questions in your last message, so that the user sees them
  last. Number them if there are two or more.
- Use `?` only for a question that the user must answer. A rhetorical
  question gives you the next message of the user, and that turn costs
  money.
- A `?` in a URL or in code, as in `runs?id=212` or `user?.name`, is not a
  question.
- After a question, end your turn. Do not wait for the answer.
- Two agents with an open question both get the next message of the user.
  If that message answers only the other agent, do not do its work. Reply in
  one short sentence or less.
