# Conversations and mentions

A conversation is a DM, a group chat or a channel. Its members are the one
user, `user:me`, and one or more agents. This page tells which agent gets a
turn for a message, and what prompt that agent gets. The routes are in
`docs/server.md`.

## Kinds

| Kind      | Made by                                                             | Name                              | Reply mode                     |
| --------- | ------------------------------------------------------------------- | --------------------------------- | ------------------------------ |
| `dm`      | `POST /api/conversations` `{ kind: "dm", agentId }`                 | The name of the agent             | `every`                        |
| `group`   | `{ kind: "group", agentIds }`, one or more agents                   | The agent names, joined with `, ` | `mention`                      |
| `channel` | `{ kind: "channel", name, topic?, private?, replyMode?, agentIds }` | The name, which must not be empty | `mention`, or `every` if asked |

A group chat is private. A channel is public unless `private: true`.

## Channel settings

`PATCH /api/conversations/:id` changes the topic, the privacy, the reply mode
and the folder (`cwd`) of a channel. The server merges the body onto the stored values and
checks the result with `channelSettingsSchema` (`docs/forms.md`). A DM or a
group chat answers `400` "Only a channel has settings.", because a group chat
is always private and always `mention`. The name does not change.

- The server reads the reply mode at each message. So a change applies to the
  next message of the user, with no restart.
- The rule of a process that runs keeps the topic and the reply mode of its
  start (`docs/agent-environment.md`). The agent can read the new values with
  `get_conversation` (`docs/mcp.md`).
- A process that runs keeps its folder. The next process of each agent starts
  in the new folder, and resumes its Claude session (`docs/agents.md`). A
  folder that does not exist gets `400`.

A channel name has lowercase letters, numbers and hyphens only, else the
server answers `400`. Two channels cannot have the same name: the second one
gets `409`.

## Who gets a turn

For a message of the user:

- In a DM, the agent gets each message.
- In a conversation with the reply mode `every`, each agent gets each message.
- Else, each agent that the message mentions gets it.
- If the message mentions no agent, each agent with an open question gets
  it. An agent has an open question when one of its complete messages since
  the last message of the user is a question. So the user can answer a
  question with no mention. A message with a mention does not go to an agent
  with an open question, unless it mentions that agent too.

A message of an agent is a question to the user when both are true:

- It holds a `?` before a space or the end of the text. Markdown emphasis
  (`*`, `_` or `~`) can come between them. `Which branch?`,
  `Which branch? The tests need it.` and `**Which branch?**` are questions.
  The `?` in the query string `https://ci.dev/runs?id=212` and in the code
  `user?.name` is not a question.
- It mentions no other agent. `@test-runner which branch is it?` asks
  `test-runner`, not the user.

For a complete message of an agent, in a group chat or a channel, each other
agent that the message mentions gets a turn. The reply mode does not
apply, so two agents in `every` mode do not answer each other with no end.
There is no limit on a chain of mentions. The user stops it with Stop, which
interrupts each busy agent and empties each queue in the conversation.

A message that an agent sends with the `send_message` or `start_conversation`
tool follows the same rule as a complete message of that agent
(`docs/mcp.md`). Stop stops only its own conversation, so a chain that
crosses two conversations needs Stop in each.

A message that comes while an agent works waits in the queue of that agent.

## Mentions

`parseMentions(text, members)` in `server/conversation/mentions.ts` gives the
keys of the members that the text mentions, in the order of the text. A
mention is `@` and the full name of a member:

- `@test-runner` does not mention `test`, and `@test-runners` mentions
  nobody, because a name must end where the word ends.
- `dev@test-runner` is not a mention, because `@` must not follow a letter, a
  digit, `_`, `-` or `@`.
- An agent does not mention itself.
- A path is not a mention: a name followed by `/`, or by `.` and a letter,
  does not count. So `@test-runner/notes.md` mentions nobody. The `@` list
  of the composer also completes files (`docs/web-app/files.md`).

`mentionPattern(name)` holds this rule. The timeline of the web app uses it
too, to show each mention in the colour of its agent
(`docs/web-app/conversation.md`).

## The prompt

In a DM, the prompt is the text of the message. Each shared file of the
message adds a line `[Shared file: <path>]` after the text, and the prompt
after a removal starts with `[Removed file: <path>]`
(`docs/server/files.md`).

In a group chat or a channel, the prompt holds each complete message since
the last prompt of that agent, one line for each, with its author:

```
[User] @reviewer-bot look at PR 212.
[reviewer-bot] The key is on a fragment.
[User] @test-runner add a test for it.
```

- The messages of the agent itself are left out.
- A message with shared files has a `[Shared file: <path>]` line for each
  file after its own line.
- The user is `User`. An agent is its name.
- The server keeps the place of the last prompt of each agent in memory.
  After a server start, it uses the last item of that agent in the
  conversation, or the place where the agent joined if that is later. So the
  first prompt of a new member holds only the messages after it joined. A
  removed agent loses its place in memory, so an agent that joins again
  starts at its new join.
- New session moves that place to its divider, because the agent forgot the
  conversation (`docs/server.md`).

## The state of an agent

`GET /api/agents` gives each agent one state for all its conversations: the
most urgent state of its live sessions, in this order: `waiting`, `busy`,
`starting`, `failed`, `idle`. An agent with no live session is `exited`.

## Members

`POST /api/conversations/:id/members` with `{ agentIds }` adds agents to a
group chat or a channel, and `DELETE /api/conversations/:id/members/:agentId`
removes one (`docs/server.md`).

- A DM refuses both with `400`, because a DM has one agent.
- A group chat keeps its last agent: `400` "A group chat needs one agent or
  more." A channel can have no agents.
- A group chat has the names of its agents as its name, so a change of
  members changes its name. A channel keeps its name.
- A new member goes to the end of the list. The store keeps the `seq` when
  it joined, in `conversation_members.joined_seq`.
- A removed agent stops its process in that conversation, and its queue
  empties. Its items stay in the timeline. Its old session rows stay too, so
  if it joins again, its next process resumes its old Claude session.
