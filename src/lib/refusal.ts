export const NO_ANSWER = "The server did not answer."

export async function refusalOf(
  request: Promise<Response>
): Promise<string | null> {
  try {
    const response = await request
    if (response.ok) return null
    const body = (await response.json()) as { error?: string }
    return body.error ?? NO_ANSWER
  } catch {
    return NO_ANSWER
  }
}

export async function replyOf<T>(
  request: Promise<Response>
): Promise<{ ok: boolean; body: T } | null> {
  try {
    const response = await request
    return { ok: response.ok, body: (await response.json()) as T }
  } catch {
    return null
  }
}
