import { useState } from "react"
import { Link } from "wouter"

import { AllowedTools } from "@/components/conversation/session/allowed-tools"
import { RefusalOf } from "@/components/conversation/session/refusal-of"
import { SessionActions } from "@/components/conversation/session/session-actions"
import type {
  Refusal,
  SessionDetailsProps,
} from "@/components/conversation/session/session-details"
import { SessionFacts } from "@/components/conversation/session/session-facts"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type SheetViews = {
  current: string
  onShow: (view: string) => void
  configureHref: string
}

const VIEWS = [
  { value: "messages", label: "Messages" },
  { value: "files", label: "Files" },
  { value: "log", label: "Session log" },
]

export function SessionSheet({
  open,
  onOpenChange,
  views,
  ...details
}: SessionDetailsProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  views?: SheetViews
}) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 max-w-[85vw] gap-0 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Session</SheetTitle>
          <SheetDescription>One headless Claude Code process.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
          <SessionFacts card={details.card} withModel />
          <SessionActions {...details} onRefusal={setRefusal} />
          {details.card && (
            <>
              <Separator />
              <h3 className="m-0 text-sm font-semibold text-foreground-strong">
                Allowed tools
              </h3>
              <AllowedTools tools={details.card.allowedTools} />
              <p className="m-0 text-xs text-foreground-faint">
                Other tools wait for your approval.
              </p>
            </>
          )}
          {views && (
            <>
              <Separator />
              <nav aria-label="Views" className="flex flex-wrap gap-2">
                {VIEWS.map((view) => (
                  <Button
                    key={view.value}
                    variant={
                      views.current === view.value ? "secondary" : "outline"
                    }
                    size="sm"
                    aria-current={
                      views.current === view.value ? "page" : undefined
                    }
                    onClick={() => views.onShow(view.value)}
                  >
                    {view.label}
                  </Button>
                ))}
                <Link
                  href={views.configureHref}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Configure
                </Link>
              </nav>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
