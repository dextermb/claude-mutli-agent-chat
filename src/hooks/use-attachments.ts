import { useState } from "react"

import type { SharedFile } from "@/lib/agent-api"
import { uploadFile } from "@/lib/upload"

export type Attachment = {
  key: string
  name: string
  size: number
  status: "copying" | "copied" | "linked" | "refused" | "failed"
  progress: number
  path: string | null
  problem: string | null
  file: File | null
}

let nextKey = 0

export function useAttachments(conversationId: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  function change(key: string, update: Partial<Attachment>) {
    setAttachments((items) =>
      items.map((item) => (item.key === key ? { ...item, ...update } : item))
    )
  }

  async function copy(key: string, file: File) {
    change(key, { status: "copying", progress: 0, problem: null })
    const answer = await uploadFile(
      `/api/conversations/${conversationId}/uploads?name=${encodeURIComponent(file.name)}`,
      file,
      (progress) => change(key, { progress })
    )
    if (answer.ok) {
      change(key, {
        status: "copied",
        progress: 1,
        name: answer.file.name,
        path: answer.file.path,
        size: answer.file.size,
      })
    } else {
      change(key, { status: "failed", problem: answer.error })
    }
  }

  function addFiles(files: { file: File; isFolder: boolean }[]) {
    const added = files.map(({ file, isFolder }) => ({
      key: `attachment-${(nextKey += 1)}`,
      name: file.name,
      size: file.size,
      status: isFolder ? ("refused" as const) : ("copying" as const),
      progress: 0,
      path: null,
      problem: isFolder
        ? "A folder cannot be shared. Drop the files in it."
        : null,
      file: isFolder ? null : file,
    }))
    setAttachments((items) => [...items, ...added])
    for (const item of added) {
      if (item.file) void copy(item.key, item.file)
    }
  }

  function remove(key: string) {
    setAttachments((items) => items.filter((item) => item.key !== key))
  }

  function retry(key: string) {
    const item = attachments.find((attachment) => attachment.key === key)
    if (item?.file) void copy(key, item.file)
  }

  const shared: SharedFile[] = attachments.flatMap((item) =>
    (item.status === "copied" || item.status === "linked") && item.path
      ? [
          {
            name: item.name,
            path: item.path,
            kind: item.status === "linked" ? "linked" : "copied",
            size: item.size,
          },
        ]
      : []
  )
  const blocking = attachments.find(
    (item) =>
      item.status === "copying" ||
      item.status === "refused" ||
      item.status === "failed"
  )

  return {
    attachments,
    shared,
    blocking,
    addFiles,
    remove,
    retry,
    clear: () => setAttachments([]),
  }
}
