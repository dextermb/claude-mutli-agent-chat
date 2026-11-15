import { vi } from "vitest"

export type SentRequest = { method: string; url: string; body: unknown }

type Responder = (body: unknown) => { status: number; body: unknown }

export class FakeEventSource {
  static opened: FakeEventSource[] = []
  readonly url: string
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeEventSource.opened.push(this)
  }

  emit(id: number, data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify(data),
        lastEventId: String(id),
      })
    )
  }

  close() {
    this.closed = true
  }
}

export function fakeNetwork() {
  const routes = new Map<string, Responder>()
  const sent: SentRequest[] = []
  FakeEventSource.opened = []

  vi.stubGlobal("EventSource", FakeEventSource)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined
      sent.push({ method, url: input, body })
      const responder = routes.get(`${method} ${input}`)
      const reply = responder
        ? responder(body)
        : { status: 404, body: { error: "not found" } }
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { "content-type": "application/json" },
      })
    })
  )

  return {
    sent,
    on(method: string, url: string, reply: unknown, status = 200) {
      routes.set(`${method} ${url}`, () => ({ status, body: reply }))
    },
    stream(address?: string) {
      const source = FakeEventSource.opened.findLast(
        (opened) => address === undefined || opened.url.startsWith(address)
      )
      if (!source) throw new Error("No event stream is open")
      return source
    },
  }
}
