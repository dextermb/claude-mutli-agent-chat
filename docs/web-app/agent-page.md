# The agent page

`src/pages/agents/[id].tsx` holds the form for a new agent and for a saved
agent.

The form sends every field. A new agent goes to `POST /api/agents`, then the
page moves to `/agents/<id>`. A saved agent goes to `PATCH /api/agents/:id`.
The form checks each field with the schema of the server, and shows each
message under its field. If the server refuses the agent, the page shows the
reason in an alert, and each message of the server under its field. See
`docs/forms.md`.

The model and the permission mode use a native `<select>`
(`native-select`), because it is accessible and easy to test.

A change to an agent does not change a process that runs. The next process
uses the new configuration.

"Start when the app opens" (`autostart`) is off for a new agent. The design
shows it on. When it is on, the server starts the DM process of the agent at
each server start (`docs/server.md`).
