# The documentation

These pages tell what the app does today. Start with `architecture.md`. It
gives the parts of the app, the main decisions, and the risks.

## The agent server

| Page                   | Open it for                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `architecture.md`      | The parts of the app, the decisions with their reasons, and the risks        |
| `protocol.md`          | The Claude Code stream that the server reads, and how to record its fixtures |
| `timeline.md`          | How the server turns the stream into timeline items                          |
| `agents.md`            | The `claude` process of each agent session, and its command line             |
| `agent-environment.md` | The rule that tells each agent about the chat app, and the `chat` plugin     |
| `mcp.md`               | The `chat` MCP server that each agent gets, and its tools                    |
| `store.md`             | The SQLite tables and the queries                                            |
| `server.md`            | The routes and the event stream                                              |
| `server/routes.md`     | Each route, its body and its result                                          |
| `server/files.md`      | Uploads, shared files, the `@` search of paths, and Browse folders           |
| `conversations.md`     | Who gets a turn, mentions, and the shape of a prompt                         |
| `sleep.md`             | Sleep and wake: the timer, the compaction, the wake prompt, the summary      |

## The web app

| Page                       | Open it for                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `web-app.md`               | The pages, how to run the app, the shared types, and the design boards       |
| `web-app/conversation.md`  | `useConversation()`, the parts of the timeline, and the `@` list             |
| `web-app/messages.md`      | The Markdown of a message, the code blocks, and the mentions                 |
| `web-app/components.md`    | The directories of `src/components` and the helpers in `src/lib`             |
| `web-app/session-panel.md` | The session panel, the members of a channel, and the DM tabs                 |
| `web-app/sidebar.md`       | The sidebar, `useWorkspace()`, and the dialogs of the sidebar                |
| `web-app/agent-page.md`    | The form for a new or a saved agent                                          |
| `web-app/files.md`         | Attach, drop and `@` files, and the shared files in the thread and the panel |
| `web-app/scroll.md`        | How the messages stick to the bottom, and the jump button                    |
| `forms.md`                 | The two forms, the shared Zod schema, and the shape of a refusal             |
| `routing.md`               | The file-based router: from a file in `src/pages` to a URL                   |

## The project

| Page         | Open it for                                      |
| ------------ | ------------------------------------------------ |
| `testing.md` | The test set-up, the two projects, and the seams |

The folder `plans/` holds work that is not built yet. It is not part of the
specification.
