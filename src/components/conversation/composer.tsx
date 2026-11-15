import { ArrowUpIcon } from "lucide-react"
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

const MENTION_AT_CARET = /(?:^|\s)@([\w-]*)$/

export function Composer({
  label,
  members,
  onSend,
}: {
  label: string
  members: string[]
  onSend: (text: string) => void
}) {
  const [text, setText] = useState("")
  const [caret, setCaret] = useState(0)
  const box = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const listId = useId()

  useLayoutEffect(() => {
    const at = pendingCaret.current
    if (at === null || !box.current) return
    pendingCaret.current = null
    box.current.focus()
    box.current.setSelectionRange(at, at)
  })

  const typed = MENTION_AT_CARET.exec(text.slice(0, caret))
  const suggestions = typed
    ? members.filter((name) =>
        name.toLowerCase().startsWith(typed[1].toLowerCase())
      )
    : []

  function update(value: string, at: number) {
    setText(value)
    setCaret(at)
  }

  function pick(name: string) {
    if (!typed) return
    const start = caret - typed[1].length
    const next = `${text.slice(0, start)}${name} ${text.slice(caret)}`
    const at = start + name.length + 1
    pendingCaret.current = at
    update(next, at)
  }

  function send(event?: FormEvent) {
    event?.preventDefault()
    const message = text.trim()
    if (message === "") return
    onSend(message)
    update("", 0)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      suggestions.length > 0 &&
      (event.key === "Tab" || event.key === "Enter")
    ) {
      event.preventDefault()
      pick(suggestions[0])
      return
    }
    if (event.key === "Enter" && !event.shiftKey) send(event)
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      {suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention"
          className="m-0 flex max-w-sm list-none flex-col rounded-[14px] border bg-popover p-1.5 text-popover-foreground shadow-md"
        >
          {suggestions.map((name, index) => (
            <li
              key={name}
              role="option"
              aria-selected={index === 0}
              className="cursor-pointer rounded-[10px] px-2 py-1.5 aria-selected:bg-accent"
              onMouseDown={(event) => {
                event.preventDefault()
                pick(name)
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      <InputGroup>
        <InputGroupTextarea
          ref={box}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-expanded={suggestions.length > 0}
          placeholder={label}
          value={text}
          onChange={(event) =>
            update(
              event.currentTarget.value,
              event.currentTarget.selectionStart
            )
          }
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="block-end">
          <span className="ml-auto text-xs text-foreground-faint">
            {suggestions.length > 0 ? "Tab to pick" : "Enter to send"}
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
