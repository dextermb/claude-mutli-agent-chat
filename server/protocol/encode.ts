import type { Json } from "./decode.ts"

export function encodePrompt(text: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
  })
}

export function encodeInitialize(requestId: string): string {
  return JSON.stringify({
    type: "control_request",
    request_id: requestId,
    request: { subtype: "initialize" },
  })
}

export function encodeInterrupt(requestId: string): string {
  return JSON.stringify({
    type: "control_request",
    request_id: requestId,
    request: { subtype: "interrupt" },
  })
}

export type PermissionAnswer =
  | { behavior: "allow"; updatedInput: Json; updatedPermissions?: Json[] }
  | { behavior: "deny"; message: string }

export function encodePermissionAnswer(
  requestId: string,
  answer: PermissionAnswer
): string {
  return JSON.stringify({
    type: "control_response",
    response: { subtype: "success", request_id: requestId, response: answer },
  })
}
