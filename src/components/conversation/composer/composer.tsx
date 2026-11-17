import { ArrowUpIcon, PaperclipIcon } from "lucide-react"
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { AttachmentChip } from "@/components/conversation/composer/attachment-chip"
import { MentionSuggestions } from "@/components/conversation/composer/mention-suggestions"
import type { PathOption } from "@/components/conversation/composer/path-option"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import type { useAttachments } from "@/hooks/use-attachments"
import type { AgentWithState, SharedFile } from "@/lib/agent-api"
import { blockingHint } from "@/lib/attachment-hint"

const MENTION_AT_CARET = /(?:^|\s)@([\w./-]*)$/

type Member = Pick<
  AgentWithState,
  "id" | "name" | "displayName" | "colour" | "state"
>

export function Composer({
  label,
  members,
  onSend,
  attachments,
  searchPaths,
  tools,
}: {
  label: string
  members: Member[]
  onSend: (text: string, files: SharedFile[]) => void
  attachments?: ReturnType<typeof useAttachments>
  searchPaths?: (query: string) => Promise<PathOption[]>
  tools?: ReactNode
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState({ query: "", index: 0 })
  const [dismissed, setDismissed] = useState<string | null>(null)
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
  const suggestions =
    typed && typed[1] !== dismissed
      ? members.filter((member) =>
          [member.name, member.displayName ?? ""].some((name) =>
            name.toLowerCase().startsWith(typed[1].toLowerCase())
          )
        )
      : []
  const query = typed && typed[1] !== dismissed ? typed[1] : null
  const [found, setFound] = useState<{ query: string; paths: PathOption[] }>({
    query: "",
    paths: [],
  })
  useEffect(() => {
    if (!searchPaths || !query) return
    let current = true
    searchPaths(query)
      .then((paths) => {
        if (current) setFound({ query, paths })
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [query, searchPaths])
  const fileSuggestions = query && found.query === query ? found.paths : []
  const optionCount = suggestions.length + fileSuggestions.length
  const activeIndex =
    typed && active.query === typed[1] && active.index < optionCount
      ? active.index
      : 0

  function update(value: string, at: number) {
    setText(value)
    setCaret(at)
    setDismissed(null)
  }

  function pickFile(option: PathOption) {
    pick(option.relative)
    attachments?.addPath(option.path)
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
    const files = attachments?.shared ?? []
    if (attachments?.blocking) return
    if (message === "" && files.length === 0) return
    onSend(message, files)
    update("", 0)
    attachments?.clear()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (typed && optionCount > 0 && event.key === "Escape") {
      event.preventDefault()
      setDismissed(typed[1])
      return
    }
    if (typed && optionCount > 0 && step) {
      event.preventDefault()
      const count = optionCount
      setActive({
        query: typed[1],
        index: (activeIndex + step + count) % count,
      })
      return
    }
    if (optionCount > 0 && (event.key === "Tab" || event.key === "Enter")) {
      event.preventDefault()
      if (activeIndex < suggestions.length) pick(suggestions[activeIndex].name)
      else pickFile(fileSuggestions[activeIndex - suggestions.length])
      return
    }
    if (event.key === "Enter" && !event.shiftKey) send(event)
  }

  return (
    <form aria-label={label} onSubmit={send} className="flex flex-col gap-2">
      {optionCount > 0 && (
        <MentionSuggestions
          listId={listId}
          members={suggestions}
          files={fileSuggestions}
          activeIndex={activeIndex}
          onPickMember={pick}
          onPickFile={pickFile}
        />
      )}
      <InputGroup>
        {attachments && attachments.attachments.length > 0 && (
          <InputGroupAddon align="block-start">
            <ul
              aria-label="Files for this message"
              className="m-0 grid w-full list-none grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-2 p-0"
            >
              {attachments.attachments.map((item) => (
                <li key={item.key} className="min-w-0">
                  <AttachmentChip
                    item={item}
                    onRemove={() => attachments.remove(item.key)}
                    onRetry={() => attachments.retry(item.key)}
                  />
                </li>
              ))}
            </ul>
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={box}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={
            optionCount > 0
              ? [
                  suggestions.length > 0 ? listId : null,
                  fileSuggestions.length > 0 ? `${listId}-files` : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : undefined
          }
          aria-activedescendant={
            optionCount > 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-expanded={optionCount > 0}
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
          {attachments && (
            <>
              <InputGroupButton
                variant="outline"
                size="icon-xs"
                className="rounded-full"
                aria-label="Attach a file"
                onClick={() => fileInput.current?.click()}
              >
                <PaperclipIcon />
              </InputGroupButton>
              <input
                ref={fileInput}
                type="file"
                multiple
                aria-label="Files to attach"
                className="hidden"
                onChange={(event) => {
                  attachments.addFiles(
                    [...(event.currentTarget.files ?? [])].map((file) => ({
                      file,
                      isFolder: false,
                    }))
                  )
                  event.currentTarget.value = ""
                }}
              />
            </>
          )}
          {tools}
          {attachments?.blocking ? (
            <span className="ml-auto text-xs text-foreground-faint">
              {blockingHint(attachments.blocking)}
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs text-foreground-faint">
              <Kbd>{optionCount > 0 ? "Tab" : "Enter"}</Kbd>
              {optionCount > 0 ? "to pick" : "to send"}
            </span>
          )}
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
            className="rounded-full"
            aria-label="Send"
            disabled={Boolean(attachments?.blocking)}
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
