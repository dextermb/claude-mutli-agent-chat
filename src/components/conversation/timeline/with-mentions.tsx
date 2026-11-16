import { FileIcon } from "lucide-react"
import type { ReactNode } from "react"

import { MENTION_COLOURS } from "@/components/conversation/agent-look"
import type { ConversationAgent } from "@/lib/agent-api"
import { cn } from "@/lib/utils"
import { mentionPattern } from "../../../../server/conversation/mentions.ts"

type Mention = { at: number; text: string; agent?: ConversationAgent }

const FILE_MENTION = /(?<![\w@-])@([\w./-]*[\w-])/g

export function withMentions(text: string, agents: ConversationAgent[]) {
  const agentMentions: Mention[] = agents.flatMap((agent) =>
    [...text.matchAll(mentionPattern(agent.name, "g"))].map((match) => ({
      at: match.index,
      text: match[0],
      agent,
    }))
  )
  const fileMentions: Mention[] = [...text.matchAll(FILE_MENTION)]
    .filter((match) => /\/|\.\w+$/.test(match[1]))
    .map((match) => ({ at: match.index, text: match[0] }))
  const parts: ReactNode[] = []
  let end = 0
  for (const mention of [...agentMentions, ...fileMentions].sort(
    (a, b) => a.at - b.at
  )) {
    parts.push(text.slice(end, mention.at))
    parts.push(
      mention.agent ? (
        <span
          key={mention.at}
          className={cn(
            "rounded-sm px-1 font-medium",
            MENTION_COLOURS[mention.agent.colour]
          )}
        >
          {mention.text}
        </span>
      ) : (
        <span
          key={mention.at}
          className="relative rounded-sm bg-link/10 px-1 font-mono text-[13px] text-link"
        >
          <FileIcon
            aria-hidden="true"
            className="mr-1 inline size-3.5 align-[-2px]"
          />
          <span className="sr-only">@</span>
          {mention.text.slice(1)}
        </span>
      )
    )
    end = mention.at + mention.text.length
  }
  parts.push(text.slice(end))
  return parts
}
