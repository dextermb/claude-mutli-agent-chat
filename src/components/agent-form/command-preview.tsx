import { ChevronRightIcon, CopyIcon, TerminalIcon } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { commandText } from "@/lib/command"
import {
  claudeArgs,
  type AgentConfig,
} from "../../../server/session/claude-args.ts"

export function CommandPreview({
  id,
  agent,
  cwd,
}: {
  id?: string
  agent: AgentConfig
  cwd: string
}) {
  const headingId = useId()
  const text = commandText(
    "claude",
    claudeArgs(
      agent,
      { claudeSessionId: "<session id>" },
      {
        pluginDir: "<chat plugin>",
        mcpConfig: "<chat server>",
        addDir: "<uploads>",
        systemPrompt: agent.systemPrompt
          ? "<rule> + <system prompt>"
          : "<rule>",
      }
    )
  )
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-5 rounded-[14px] border bg-rail"
    >
      <details className="group/command">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-open/command:rotate-90"
          />
          <TerminalIcon aria-hidden="true" className="size-4" />
          <h2
            id={headingId}
            className="m-0 flex-1 text-sm font-semibold text-foreground-strong"
          >
            Command
          </h2>
          <span className="text-xs text-foreground-faint">
            The claude command of these settings
          </span>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-xs text-foreground-faint">
              The app starts this in{" "}
              {cwd || "the folder of each channel, or in a scratch folder,"}{" "}
              for each conversation.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(text)
              }}
            >
              <CopyIcon />
              Copy
            </Button>
          </div>
          <pre className="m-0 overflow-x-auto font-mono text-[13px] leading-[22px]">
            <code>{text}</code>
          </pre>
        </div>
      </details>
    </section>
  )
}
