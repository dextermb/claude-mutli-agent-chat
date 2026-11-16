import type { ReactNode } from "react"
import { Link } from "wouter"

import { ROW_CLASS } from "@/components/sidebar/row-class"
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function ConversationRow({
  conversation,
  current,
  unread,
  onNavigate,
  children,
}: {
  conversation: Conversation
  current: boolean
  unread: number
  onNavigate: () => void
  children: ReactNode
}) {
  const count = current ? 0 : unread
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={current}
        className={cn(
          ROW_CLASS,
          count > 0 && "font-semibold text-foreground-strong"
        )}
        render={
          <Link
            href={`/conversations/${conversation.id}`}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
          />
        }
      >
        {children}
        {count > 0 && (
          <>
            {" "}
            <span className="sr-only">{`${count} unread`}</span>
          </>
        )}
      </SidebarMenuButton>
      {count > 0 && (
        <SidebarMenuBadge
          aria-hidden="true"
          className="bg-mention text-primary-foreground peer-hover/menu-button:text-primary-foreground"
        >
          {count}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  )
}
