export type Uploaded = { name: string; path: string; size: number }

export function uploadFile(
  url: string,
  file: Blob,
  onProgress: (fraction: number) => void
): Promise<{ ok: true; file: Uploaded } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    }
    request.onload = () => {
      let body: { error?: string } & Partial<Uploaded> = {}
      try {
        body = JSON.parse(request.responseText) as typeof body
      } catch {
        body = {}
      }
      if (request.status >= 200 && request.status < 300 && body.path) {
        resolve({ ok: true, file: body as Uploaded })
      } else {
        resolve({ ok: false, error: body.error ?? "The copy did not work." })
      }
    }
    request.onerror = () =>
      resolve({ ok: false, error: "The copy did not work." })
    request.send(file)
  })
}
