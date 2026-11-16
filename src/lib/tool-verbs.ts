export const VERBS: Record<
  string,
  { running: string; done: string; failed: string }
> = {
  Read: { running: "Reading", done: "Read", failed: "Failed to read" },
  Edit: { running: "Editing", done: "Edited", failed: "Failed to edit" },
  Write: { running: "Writing", done: "Wrote", failed: "Failed to write" },
  Bash: { running: "Running", done: "Ran", failed: "Failed to run" },
  WebFetch: {
    running: "Fetching",
    done: "Fetched",
    failed: "Failed to fetch",
  },
  Agent: {
    running: "Running the subagent:",
    done: "Ran the subagent:",
    failed: "The subagent failed:",
  },
}
