import { ShieldIcon } from "lucide-react"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { describeGrants } from "@/lib/grants"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { PermissionItem } from "@/lib/agent-api"

const DONE_LABEL: Record<
  Exclude<PermissionItem["status"], "pending">,
  string
> = {
  allowed: "Allowed",
  denied: "Denied",
  expired: "Expired",
}

export function Approval({
  request,
  label,
  agentName,
  onAnswer,
}: {
  request: PermissionItem
  label: string
  agentName: string
  onAnswer: (requestId: string, answer: RequestAnswer) => Promise<boolean>
}) {
  const grantsId = useId()
  const [sending, setSending] = useState(false)
  const answer = (decision: "allow_once" | "always_allow" | "deny") => {
    setSending(true)
    void onAnswer(request.requestId, { decision }).then((taken) => {
      if (!taken) setSending(false)
    })
  }
  if (request.status !== "pending") {
    return (
      <div
        role="region"
        aria-label={`Approval for ${label}`}
        className="pl-6 text-xs text-foreground-faint"
      >
        {DONE_LABEL[request.status]}
      </div>
    )
  }
  return (
    <div
      role="region"
      aria-label={`Approval for ${label}`}
      className="flex flex-col gap-1.5"
    >
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <ShieldIcon aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Allow {label}?</ItemTitle>
          <ItemDescription>
            This tool is not in the allowed tools of {agentName}.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => answer("deny")}
          >
            Deny
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => answer("allow_once")}
          >
            Allow once
          </Button>
          {request.suggestions.length > 0 && (
            <Button
              size="sm"
              aria-describedby={grantsId}
              disabled={sending}
              onClick={() => answer("always_allow")}
            >
              Always allow
            </Button>
          )}
        </ItemActions>
      </Item>
      {request.suggestions.length > 0 && (
        <span
          id={grantsId}
          className="text-xs leading-[18px] text-foreground-faint"
        >
          <span aria-hidden="true">Always allow: </span>
          {describeGrants(request.suggestions, agentName)}
        </span>
      )}
    </div>
  )
}
