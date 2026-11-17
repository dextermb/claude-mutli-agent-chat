# The components

Each file in `src/components` holds one component. A directory groups the
components of one kind or of one part of the page. A name has no prefix when a
directory gives the same information.

## Rules

- One file, one component. A helper that returns no JSX goes to `src/lib`. A
  hook goes to `src/hooks`.
- A file stays small. A component that grows past about 250 lines gets split.
- A directory names a kind (`dialogs`, `fields`, `alerts`) or a part
  (`sidebar`, `conversation`). Do not prefix a file name with the name of its
  directory.
- Add shadcn components to `ui` with the shadcn CLI. Do not edit them by hand.

## The directories

| Directory                     | Holds                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `alerts`                      | `RefusalAlert`, the alert for a refused request                                                                    |
| `agent-actions`               | The Stop and Restart actions of the agent page                                                                     |
| `agent-form`                  | The command preview, the tool rules, the permission mode cards and the colour swatches of the agent form           |
| `forms`                       | The layout of a form on a page: a section, On this page, and the bar at the foot. See `docs/forms.md`              |
| `dialogs`                     | The dialogs that open from a page: create a channel, start a chat, add members, the delete confirm and its section |
| `dialogs/channel-settings`    | The Channel settings dialog and its form                                                                           |
| `dialogs/group-chat-settings` | The Group chat settings dialog and its form                                                                        |
| `dialogs/folder`              | The Pick a folder dialog and its picker                                                                            |
| `fields/channel`              | One field of the channel forms in each file. The Rules field is also in Group chat settings                        |
| `sidebar`                     | The sidebar, its rows and their ×, its sections, the workspace rail and the work footer                            |
| `theme`                       | The theme provider, its context and `useTheme`                                                                     |
| `conversation`                | The parts of a conversation page: the working line and the Rules badge. See `docs/web-app/conversation.md`         |
| `conversation/cards`          | The approval card and the question card                                                                            |
| `conversation/composer`       | The message box, its mention list, its attachment chip, the model and the context                                  |
| `conversation/files`          | The shared files: the panel, the list, a row, the files of a message and the tab                                   |
| `conversation/session`        | The session panel, the sheet, the members panel and the session log                                                |
| `conversation/timeline`       | The timeline, its dividers, groups, entries and mentions, and the jump button                                      |
| `conversation/tool-call`      | A tool call line, its description, its diff and its output                                                         |
| `ui`                          | The shadcn components                                                                                              |

## The helpers

| File in `src/lib`    | Holds                                                |
| -------------------- | ---------------------------------------------------- |
| `timeline.ts`        | The grouping and the lookups of the timeline entries |
| `theme.ts`           | The theme types, the system theme and the key filter |
| `tool-input.ts`      | The main input of a tool call                        |
| `tool-verbs.ts`      | The verbs for each tool and each status              |
| `working.ts`         | What an agent does now, and when its turn started    |
| `grants.ts`          | The text of a permission suggestion                  |
| `question.ts`        | The shape of a question of an agent                  |
| `context.ts`         | The context percent and the token count              |
| `cost.ts`            | The text of a cost in dollars                        |
| `format-size.ts`     | The text of a file size                              |
| `attachment-hint.ts` | The hint that tells why Send waits                   |
| `folder-list.ts`     | The shape of the folder list of the server           |
| `highlight.ts`       | The syntax colours of a code block, with Shiki       |
| `delete-targets.ts`  | The title, the list and the route of a delete        |
| `changed-fields.ts`  | The fields that differ from the saved values         |
| `toasts.ts`          | The success toast and the error toast                |
