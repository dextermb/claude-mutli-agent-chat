import { Fragment } from "react"

import { withMentions } from "@/components/conversation/timeline/with-mentions"
import type { ConversationAgent } from "@/lib/agent-api"

export function MessageText({
  text,
  agents,
}: {
  text: string
  agents: ConversationAgent[]
}) {
  return (
    <>
      {text.split(/`([^`\n]+)`/).map((part, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="rounded-sm bg-muted px-[5px] py-px font-mono text-[13px] text-agent-yellow"
          >
            {part}
          </code>
        ) : (
          <Fragment key={index}>{withMentions(part, agents)}</Fragment>
        )
      )}
    </>
  )
}
