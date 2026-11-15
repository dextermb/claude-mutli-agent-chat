import { z } from "zod"

export type RpcMessage = Record<string, unknown>

export type Tool = {
  name: string
  description: string
  input: z.ZodType
  run: (input: unknown) => unknown
}

export class ToolError extends Error {}

const SERVER_INFO = { name: "chat", version: "0.1.0" }
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"]

export function answerRpc(
  message: RpcMessage,
  tools: Tool[]
): RpcMessage | null {
  if (message.id === undefined) return null
  const reply = (body: RpcMessage) => ({
    jsonrpc: "2.0",
    id: message.id,
    ...body,
  })
  const params = (message.params ?? {}) as RpcMessage
  if (message.method === "initialize") {
    const asked = String(params.protocolVersion)
    return reply({
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked)
          ? asked
          : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    })
  }
  if (message.method === "ping") return reply({ result: {} })
  if (message.method === "tools/list") {
    return reply({
      result: {
        tools: tools.map(({ name, description, input }) => ({
          name,
          description,
          inputSchema: z.toJSONSchema(input),
        })),
      },
    })
  }
  if (message.method === "tools/call") {
    const found = tools.find((item) => item.name === params.name)
    if (!found) {
      return reply({
        error: {
          code: -32602,
          message: `Unknown tool: ${String(params.name)}`,
        },
      })
    }
    return reply({ result: callTool(found, params.arguments ?? {}) })
  }
  return reply({
    error: {
      code: -32601,
      message: `Method not found: ${String(message.method)}`,
    },
  })
}

function callTool(tool: Tool, input: unknown): RpcMessage {
  const checked = tool.input.safeParse(input)
  if (!checked.success) {
    return toolText(z.prettifyError(checked.error), true)
  }
  try {
    return toolText(JSON.stringify(tool.run(checked.data), null, 2), false)
  } catch (error) {
    if (error instanceof ToolError) return toolText(error.message, true)
    throw error
  }
}

function toolText(text: string, isError: boolean): RpcMessage {
  return { content: [{ type: "text", text }], ...(isError ? { isError } : {}) }
}

export function tool<T extends z.ZodType>(
  name: string,
  description: string,
  input: T,
  run: (input: z.output<T>) => unknown
): Tool {
  return { name, description, input, run: (value) => run(value as z.output<T>) }
}
