import { ArrowUpIcon } from "lucide-react"
import { useState, type FormEvent, type KeyboardEvent } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

export function Composer({
  label,
  onSend,
}: {
  label: string
  onSend: (text: string) => void
}) {
  const [text, setText] = useState("")

  function send(event?: FormEvent) {
    event?.preventDefault()
    const message = text.trim()
    if (message === "") return
    onSend(message)
    setText("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) send(event)
  }

  return (
    <form onSubmit={send}>
      <InputGroup>
        <InputGroupTextarea
          aria-label={label}
          placeholder={label}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="block-end">
          <span className="ml-auto text-xs text-foreground-faint">
            Enter to send
          </span>
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
            aria-label="Send"
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
