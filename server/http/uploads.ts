import { createWriteStream } from "node:fs"
import { mkdir, open, rm } from "node:fs/promises"
import type { IncomingMessage } from "node:http"
import { basename, extname, join } from "node:path"

export const UPLOAD_LIMIT = 25 * 1024 * 1024

export type Upload = { name: string; path: string; size: number }

export type UploadAnswer =
  { status: 201; body: Upload } | { status: 400 | 413; body: { error: string } }

export function uploadsOf(uploadsFolder: string, conversationId: string) {
  return join(uploadsFolder, conversationId)
}

export async function saveUpload(
  request: IncomingMessage,
  folder: string,
  askedName: string,
  limit: number
): Promise<UploadAnswer> {
  const name = basename(askedName.replaceAll("\\", "/")).trim()
  if (name === "" || name === "." || name === "..") {
    return { status: 400, body: { error: "Give the name of the file." } }
  }
  if (Number(request.headers["content-length"] ?? 0) > limit) {
    request.resume()
    return { status: 413, body: { error: limitText(limit) } }
  }
  await mkdir(folder, { recursive: true })
  const { path, name: freeName } = await claimName(folder, name)
  let size = 0
  const out = createWriteStream(path)
  try {
    for await (const chunk of request) {
      size += (chunk as Buffer).length
      if (size > limit) throw new Error("too large")
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => out.once("drain", () => resolve()))
      }
    }
    await new Promise<void>((resolve, reject) =>
      out.end((error?: Error | null) => (error ? reject(error) : resolve()))
    )
  } catch {
    out.destroy()
    await rm(path, { force: true })
    request.resume()
    return { status: 413, body: { error: limitText(limit) } }
  }
  return { status: 201, body: { name: freeName, path, size } }
}

async function claimName(
  folder: string,
  name: string
): Promise<{ path: string; name: string }> {
  const extension = extname(name)
  const stem = name.slice(0, name.length - extension.length)
  for (let number = 1; ; number += 1) {
    const candidate = number === 1 ? name : `${stem} (${number})${extension}`
    const path = join(folder, candidate)
    try {
      const handle = await open(path, "wx")
      await handle.close()
      return { path, name: candidate }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
  }
}

function limitText(limit: number): string {
  return `The limit is ${Math.round(limit / (1024 * 1024))} MB.`
}
