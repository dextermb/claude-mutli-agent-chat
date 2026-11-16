import {
  ArrowUpIcon,
  FileIcon,
  FolderIcon,
  PaperclipIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"

import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import type { Attachment, useAttachments } from "@/hooks/use-attachments"
import type { AgentWithState, SharedFile } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const MENTION_AT_CARET = /(?:^|\s)@([\w-]*)$/

type Member = Pick<AgentWithState, "id" | "name" | "colour" | "state">

export function Composer({
  label,
  members,
  onSend,
  attachments,
}: {
  label: string
  members: Member[]
  onSend: (text: string, files: SharedFile[]) => void
  attachments?: ReturnType<typeof useAttachments>
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
          member.name.toLowerCase().startsWith(typed[1].toLowerCase())
        )
      : []
  const activeIndex =
    typed && active.query === typed[1] && active.index < suggestions.length
      ? active.index
      : 0

  function update(value: string, at: number) {
    setText(value)
    setCaret(at)
    setDismissed(null)
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
    if (typed && suggestions.length > 0 && event.key === "Escape") {
      event.preventDefault()
      setDismissed(typed[1])
      return
    }
    if (typed && suggestions.length > 0 && step) {
      event.preventDefault()
      const count = suggestions.length
      setActive({
        query: typed[1],
        index: (activeIndex + step + count) % count,
      })
      return
    }
    if (
      suggestions.length > 0 &&
      (event.key === "Tab" || event.key === "Enter")
    ) {
      event.preventDefault()
      pick(suggestions[activeIndex].name)
      return
    }
    if (event.key === "Enter" && !event.shiftKey) send(event)
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      {suggestions.length > 0 && (
        <div className="flex max-w-sm flex-col gap-1 rounded-[14px] border bg-popover p-1.5 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <p
            id={`${listId}-label`}
            className="m-0 px-2 pt-1 text-xs font-medium text-muted-foreground"
          >
            Members
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={`${listId}-label`}
            className="m-0 flex list-none flex-col p-0"
          >
            {suggestions.map((member, index) => {
              const status = statusOf(member.state)
              return (
                <li
                  key={member.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 aria-selected:bg-accent"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pick(member.name)
                  }}
                >
                  <Avatar size="sm" aria-hidden="true">
                    <AvatarFallback className={AVATAR_COLOURS[member.colour]}>
                      {initialsOf(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium text-foreground-strong">
                    {member.name}
                  </span>{" "}
                  <Badge variant="outline" className={status.text}>
                    {status.label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
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
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-activedescendant={
            suggestions.length > 0 ? `${listId}-${activeIndex}` : undefined
          }
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
          {attachments && (
            <>
              <InputGroupButton
                size="icon-xs"
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
          {attachments?.blocking ? (
            <span className="ml-auto text-xs text-foreground-faint">
              {blockingHint(attachments.blocking)}
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs text-foreground-faint">
              <Kbd>{suggestions.length > 0 ? "Tab" : "Enter"}</Kbd>
              {suggestions.length > 0 ? "to pick" : "to send"}
            </span>
          )}
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
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

const BADGES: Record<
  Attachment["status"],
  { text: string; className: string }
> = {
  linked: { text: "Linked", className: "text-status-online" },
  copied: { text: "Copied", className: "text-muted-foreground" },
  copying: { text: "Copy", className: "text-status-working" },
  refused: { text: "Refused", className: "text-status-error" },
  failed: { text: "Failed", className: "text-status-error" },
}

function AttachmentChip({
  item,
  onRemove,
  onRetry,
}: {
  item: Attachment
  onRemove: () => void
  onRetry: () => void
}) {
  const badge = BADGES[item.status]
  const problem = item.status === "refused" || item.status === "failed"
  return (
    <Item
      size="sm"
      variant="outline"
      className={cn(
        "flex-nowrap bg-rail",
        problem && "border-destructive bg-error-soft"
      )}
    >
      <ItemMedia variant="icon">
        {item.status === "refused" ? <FolderIcon /> : <FileIcon />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <span className="truncate">{item.name}</span>
          <Badge variant="outline" className={badge.className}>
            {item.status === "copying"
              ? `Copy: ${Math.round(item.progress * 100)}%`
              : badge.text}
          </Badge>
        </ItemTitle>
        <ItemDescription
          className={cn("truncate", item.path && !problem && "font-mono")}
        >
          {item.problem ?? item.path ?? formatSize(item.size)}
        </ItemDescription>
        {item.status === "copying" && (
          <Progress
            value={Math.round(item.progress * 100)}
            aria-label={`Copy of ${item.name}`}
          />
        )}
      </ItemContent>
      <ItemActions>
        {item.status === "failed" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Retry ${item.name}`}
            onClick={onRetry}
          >
            <RotateCcwIcon />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </ItemActions>
    </Item>
  )
}

function blockingHint(item: Attachment): string {
  if (item.status === "copying")
    return `Send waits until ${item.name} is copied.`
  if (item.status === "refused") return "Remove the folder to send."
  return `Retry or remove ${item.name} to send.`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
