import type { Attachment } from "@/hooks/use-attachments"

export function blockingHint(item: Attachment): string {
  if (item.status === "finding" || item.status === "copying") {
    return `Send waits until ${item.name} is shared.`
  }
  if (item.status === "refused") return "Remove the folder to send."
  return `Retry or remove ${item.name} to send.`
}
