# The conversation

A conversation is a DM, a group chat or a channel. The page of a
conversation is `src/pages/conversations/[id].tsx`, and its parts are in
`src/components/conversation/`. The pages below give each part.

| Page                                        | Open it for                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/web-app/conversation/data.md`         | `useConversation()`, the stream of events, the read of a conversation, and a refused action      |
| `docs/web-app/conversation/timeline.md`     | The blocks, the tool calls, the cards, the dividers, the notices, the times and the status words |
| `docs/web-app/conversation/working-line.md` | The line of each agent that works, and the line over the message box                             |
| `docs/web-app/conversation/header.md`       | The header of each kind, Channel settings, Group chat settings, the rules, and a deleted one     |
| `docs/web-app/conversation/composer.md`     | The message box of a DM and of a channel, and the `@` list of agents                             |

These pages are next to this folder, not in it:

- `docs/web-app/messages.md`: the Markdown of a message and the mentions.
- `docs/web-app/files.md`: attach, drop and `@` files, and the shared files.
- `docs/web-app/scroll.md`: how the thread sticks to the bottom.
- `docs/web-app/session-panel.md`: the session panel and the members.
