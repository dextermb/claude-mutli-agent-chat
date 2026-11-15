# The outstanding work of the agent chat app

**Status:** in progress. The user agreed the plan, the order and the seams
on 2026-11-15. Steps 1 to 7 are built, and their result is in `docs/*.md`.
Step 8 is next, and it needs its own short plan first. Each open question
at the end keeps the decision that shipped as the default, until the user
answers it.

## The steps

Do the steps in this order. Each step is one worktree and one branch, and it
merges into `master` before the next step starts.

| Step | Name                           | Items                                                                                                  | Schema       |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------ |
| 1    | Small fixes and message times  | Built                                                                                                  | none         |
| 2    | The stream                     | Built                                                                                                  | none         |
| 3    | The process                    | Built                                                                                                  | migration v2 |
| 4    | Live status and the event log  | Built                                                                                                  | none         |
| 5    | The session panel              | Built                                                                                                  | migration v3 |
| 6    | Members                        | Built                                                                                                  | migration v4 |
| 7    | The Files and Session log tabs | Built                                                                                                  | none         |
| 8    | TanStack Form                  | The agent page and Create a channel on TanStack Form, with validation in the browser and on the server | none         |

Steps 2 and 3 make the session and the reducer correct before step 5 puts a
card on them. Step 4 comes before step 5 because the card follows the live
state. Steps 6 and 7 are independent of each other.

## Findings from the reading

These facts shape the plan. They are not in the docs yet.

- **F-g. The status words of the design differ from the app.** The design
  says "Idle" for `idle`, "Needs approval" for `waiting`, and "Stopped" for
  `exited`. The app says "Online", "Waiting" and "Idle". See Q13.

## Step 8: TanStack Form

The user asked for this step on 2026-11-15, after step 1. It comes after
step 7. It needs its own short plan, agreed with the user, before it starts.

What is decided:

- The agent page and the Create a channel dialog move from a `useState`
  draft to TanStack Form.
- The browser validates each field, and the server keeps its own
  validation. Both apply.

The user decided on 2026-11-15: Zod, with one schema that the browser and
the server share. The plan of this step is `docs/plans/tanstack-form.md`.

## Resolved

- **Q2 (2026-11-15).** Step 1 shipped the day headings in each kind of
  conversation, as the plan proposed. The user can still ask for a change.
- **Q5 (2026-11-15).** The user agreed to spend about 0.04 USD on three real
  `claude` runs with Haiku: the two fixtures of step 2 (about 0.01 USD each)
  and the live check of `--session-id` in step 5 (about 0.02 USD).

- **Q15 (2026-11-15).** The user agreed one more recording for slice 2.3.
  The three recordings of step 2 cost 0.0209 USD in total. The live check
  of step 5 (about 0.02 USD) is still ahead.

- **Q1 (2026-11-15).** Step 3 shipped migration v2 with a rebuild of each
  stored timeline, as the plan proposed. The user can still ask for a
  change.

- **Q7 to Q11 (2026-11-15).** Step 5 shipped the defaults, as the user
  asked: a notice in the card for a changed configuration (no `set_model`),
  "Turns 7" with no limit, the panel in a group chat on a click of an agent,
  a dialog before New session, and autostart of the DM process only, with
  the switch off for a new agent. The measurements of `--session-id` (F29 to
  F31 in `docs/protocol.md`) added the `claude_session_new` column. Step 5
  spent about 0.018 USD on real `claude` runs.

- **Q12 (2026-11-15).** Step 6 shipped the default: a new member sees only
  the messages after it joins, and an agent that joins again resumes its old
  Claude session. One change from the plan: "Remove from conversation" is in
  the session panel of the agent, not in a "Members" popover, because each
  agent in the header already opens its panel.

- **Q14 (2026-11-15).** Step 7 shipped the default: the Session log follows
  new lines live. The `line` event has no ID and stays out of the replay log
  of the stream, because the many small text lines would push the other
  events out of it.

## Open questions

- **Q3.** Hide the text messages of a subagent, and show only its tool
  calls? Or show its text inside the card too?
- **Q4.** The rate-limit notice uses status names from the SDK types, not
  from a recorded line. Is that acceptable until a real line is seen?
- **Q6.** Unread rows and mention counts in the sidebar are in the design.
  Add them as a later step, or leave them out?
- **Q13.** The status words of the design differ from the app (F-g). Change
  the app to the design words ("Idle", "Needs approval", "Stopped")?
