# The header and the settings

This page gives the header of each kind of conversation, the settings
dialogs, the rules of a conversation, and a deleted conversation.

## A DM

The header shows the avatar of the agent with a status dot, its status Badge,
Stop while it works, the tabs Messages, Files and Session log, and Configure,
which opens `/agents/:id`. The messages start with a line about the agent:
"This is your DM with test-runner. In a DM, the agent replies to every
message. It runs Claude Code in /home/user/code/web-app."

## A group chat or a channel

The header shows the name, "Stop all" while an agent works, and the members
button (`docs/web-app/session-panel.md`). Each message shows its author.

The header of a channel also shows its topic, then when the agents reply:
"Agents reply when you @mention them." or "Agents reply to every message."
At the end, a ghost icon button "Channel settings" opens
`src/components/dialogs/channel-settings/channel-settings-dialog.tsx`, with the title "Channel
settings" and "#<name>". It has the Topic, Private, folder, reply-mode, sleep
and Rules fields of Create a channel (`src/components/fields/channel/`). Save sends only the
fields that changed to `PATCH /api/conversations/:id`, and closes the dialog.
With no change, Save closes it with no request. The header, the icon and the
sidebar follow the `conversation` event of the stream. A refusal shows "The
server did not save the settings." and the reason, and the dialog stays open.
At the end of the form, a bordered section "Delete channel" closes the dialog
and opens the confirm dialog of `docs/delete.md`.

The header of a group chat has the same ⋯ button, "Group chat settings". It
opens `src/components/dialogs/group-chat-settings/group-chat-settings-dialog.tsx`,
with the title "Group chat settings" and the name. It holds the Rules field,
the section "Delete group chat", Cancel and Save. Save sends `{ rules }` only
when the rules changed, and a refusal shows in the same alert as Channel
settings.

The Rules field (`src/components/fields/channel/rules-field.tsx`) is a
`Textarea` with the description "Each agent in this channel follows these
rules, also when they disagree with its own system prompt. A change reaches
an agent with its next message." A group chat says "group chat". In Create a
channel, rules over 4,000 characters show the schema error under the field
(`docs/forms.md`).

When a channel or a group chat has rules, the header shows a "Rules" Badge
button after the name and the topic (`src/components/conversation/rules-badge.tsx`).
A hover or a focus shows the rules in a Tooltip, up to six lines. A click
opens the settings dialog of that conversation. With no rules, the header
has no Badge.

When the stream sends `conversation_deleted`, the page goes to `/`. A message
of an agent that is no longer a member keeps its name, from `authors`
(`docs/delete.md`). A deleted agent shows the Badge "Deleted agent".
A DM has no settings.
