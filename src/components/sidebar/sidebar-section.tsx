import { PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "wouter"

import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar"

export function SidebarSection({
  title,
  action,
  children,
}: {
  title: string
  action:
    | { label: string; href: string; onClick: () => void }
    | { label: string; onClick: () => void }
  children: ReactNode
}) {
  return (
    <SidebarGroup aria-label={title} role="group">
      <SidebarGroupLabel render={<h2 />} className="m-0">
        {title}
      </SidebarGroupLabel>
      <SidebarGroupAction
        aria-label={action.label}
        onClick={action.onClick}
        render={"href" in action ? <Link href={action.href} /> : undefined}
      >
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
