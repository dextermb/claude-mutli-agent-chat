# The rules of a conversation

**Status:** in progress. The user agreed the plan and the seams on 2026-11-17.

The user asked on 2026-11-17 for rules in a channel and in a group chat. Each
agent in that conversation follows the rules, so the same agent can behave
differently in each conversation. Example: `#review` tells each agent "Do not
edit files. Write findings only."

## Decisions

1. **The rules go in the prompt, not in the system prompt.** A resume keeps
   the system prompt of the first process (F40). So rules in the system
   prompt stay old after a change, and the facts already go in the prompt for
   this reason (`docs/architecture.md`). The system prompt of an agent also
   stays the same in each conversation, so the prompt cache can share it
   (F51).
   - Rejected: `--append-system-prompt` with `--system-prompt-snapshot off`.
     It makes a change reach a resumed session, but not a process that runs.
     It also changes the system prompt of each agent in each conversation,
     so each conversation writes its own cache of the base.
2. **The rules are a separate `[Chat app]` block, not a line of the facts.**
   `factsNote()` compares the facts line by line. The rules are free text with
   many lines, so they get their own block and their own compare.
3. **The block goes again in full after a compaction.** A compaction can
   change the first prompt into a summary, and the summary can lose the exact
   rules. So when a `compaction` item is `done`, the server forgets the rules
   that it sent to that process. The next prompt holds the full block again.
4. **One field, `rules`, on `conversations`.** It is free text, or null. An
   empty text is null, the same as the topic.
5. **A DM has no rules.** A DM has one agent, and the system prompt of that
   agent does the same work.
6. **A group chat gets settings.** Today, `PATCH /api/conversations/:id`
   refuses a group chat. It will accept `{ rules }` for a group chat, and
   refuse each other field with `400`.

## Resolved

The user answered these on 2026-11-17.

1. **Which one wins when the rules and the system prompt of the agent
   disagree?** The rules of the conversation win, in that conversation only.
   The rule of the chat app (`agent/environment.md`) always wins over both.
   Rejected: the system prompt of the agent wins.
2. **Where can the user write the rules?** Channel settings, Create a
   channel, and Group chat settings. Not in Start a chat, because a group
   chat starts with few clicks.
3. **A limit on the length?** 4,000 characters. Each prompt after a change,
   and the first prompt of each process, holds the full text. Rejected: no
   limit.
4. **Can an agent change the rules?** No. `get_conversation` gives the
   rules, so an agent can read them. Only the user writes them. Rejected: a
   chat tool with an approval card.

## ERD

```
conversations
  id                   PK
  kind                 'dm' | 'group' | 'channel'
  name
  topic                nullable
  private
  reply_mode
  cwd                  nullable
  sleep_after_minutes  nullable
  rules                TEXT, nullable          NEW (migration 13)
  created_at
     │
     └──1:N── conversation_members (ON DELETE CASCADE), no change
```

Migration 13 adds one column. Each older row gets null. No rebuild, and the
foreign keys stay on.

## Data flows

**A change of the rules.**

```
Settings dialog -> PATCH /api/conversations/:id { rules }
  -> channelSettingsSchema, or groupSettingsSchema for a group chat
  -> store.updateConversation(id, { rules })
  -> announce(conversation)            the stream sends `conversation`
```

The server does not interrupt a process that works. The change reaches each
agent with its next prompt.

**A prompt.**

```
deliverNext(session)
  -> rulesOf(conversation)                       the text, or null
  -> rulesNote(session.rules, now)               block, or undefined
  -> notes: gap, restart, facts, rules, queued
  -> session.rules = now
  -> handle.prompt(text, notes)
```

`rulesNote(sent, now)` in `server/session/environment-prompt.ts`:

| `sent`          | `now`     | The block                                                                    |
| --------------- | --------- | ---------------------------------------------------------------------------- |
| not sent yet    | null      | No block                                                                     |
| not sent yet    | text      | `[Chat app] The rules of this channel, from the user:` then the text         |
| text            | same text | No block                                                                     |
| text            | new text  | `[Chat app] The user changed the rules of this channel. The rules now:` then the text |
| text            | null      | `[Chat app] The user removed the rules of this channel.`                     |

A group chat says "this group chat". The rules come after the facts, so the
agent reads where it is first.

**A compaction.** When the reducer marks a `compaction` item `done`, the
server sets `session.rules` to "not sent yet".

## Workflows

- **Channel settings.** A Rules field (a `Textarea`) comes after the reply
  mode. The description: "Each agent in this channel follows these rules.
  They reach an agent with its next message." Save sends only the fields that
  changed, as today.
- **Create a channel.** The same field, empty, and optional.
- **Group chat settings.** The dialog gets the Rules field, Save and Cancel,
  above the section "Delete group chat". Today the dialog holds only the
  delete section and Close.
- **The header.** A channel or a group chat with rules shows a small "Rules"
  Badge. A hover shows the first line. No rules: no Badge.
- **A refusal.** The alert "The server did not save the settings." and the
  reason, as today. A text above the limit gets the field error "Keep the
  rules to 4,000 characters or fewer."

## The build

| Part                     | The change                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `server/store/schema.ts` | Migration 13: `ALTER TABLE conversations ADD COLUMN rules TEXT`                                         |
| `server/store/store.ts`  | `rules` in `createConversation()`, `updateConversation()` and the row reader                            |
| `server/api-types.ts`    | `Conversation.rules: string \| null`                                                                    |
| `server/schemas.ts`      | `rules` in `channelSchema` and `channelSettingsSchema`. New `groupSettingsSchema` with `rules` only     |
| `server/http/server.ts`  | The PATCH route accepts a group chat. `deliverNext()` adds the rules block. A compaction resets it      |
| `server/session/environment-prompt.ts` | `rulesNote(sent, now, kind)`                                                              |
| `server/mcp/tools.ts`    | `get_conversation` gives `rules`                                                                        |
| `agent/environment.md`   | One line in "The prompt": what the rules block is, and the order of the three sources                  |
| `src/components/fields/channel/rules-field.tsx` | The Rules field                                                                  |
| The three dialogs        | The field, as in "Workflows"                                                                            |

**Tests, one slice at a time** (`.claude/rules/test-driven-development.md`).
The seams:

1. `rulesNote()`: each row of the table above.
2. The store: a version 12 file opens with `rules` null. A create and an
   update keep the text.
3. `PATCH /api/conversations/:id`: a channel and a group chat save `rules`. A
   group chat refuses `topic` with `400`. A text over the limit gets `400`
   with `fields.rules`.
4. A prompt: the first prompt holds the block. The next prompt does not. A
   change sends the new block. A compaction sends it again. Use the fake
   `claude` of `server/test`.
5. `get_conversation` gives `rules`.
6. Channel settings and Group chat settings: the user types rules, saves,
   and the request holds `rules` only.

**Docs** in the same change: `docs/conversations.md` (settings of a group
chat), `docs/agent-environment.md` (the block), `docs/store.md` (migration
13), `docs/mcp.md`, `docs/forms.md`, `docs/web-app/conversation.md`, and the
decision in `docs/architecture.md`. Then delete this plan.
