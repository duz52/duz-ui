/**
 * Pi extension: drive a real Google Chrome over the Chrome DevTools Protocol
 * (CDP), including the WebMCP surface exposed via document.modelContext.
 *
 * Chrome must be launched with --remote-debugging-port (and
 * --enable-features=WebMCP for the WebMCP tools). Override the CDP base with
 * the PI_CHROME_CDP environment variable (default http://127.0.0.1:9333).
 *
 * Node 24 globals (fetch, WebSocket, AbortSignal) are used directly; no npm
 * dependency is added.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"

// ---------------------------------------------------------------------------
// WebMCP surface (document.modelContext). Minimal local types; the extension
// has no ambient WebMCP declarations.
// ---------------------------------------------------------------------------

interface WebMcpTool {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
}

interface ModelContext {
  getTools(): Promise<WebMcpTool[]>
  executeTool(tool: WebMcpTool, inputArguments: string): Promise<string>
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}

// ---------------------------------------------------------------------------
// CDP connection helper: one WebSocket per process, reconnected when closed.
// ---------------------------------------------------------------------------

interface CdpTarget {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl: string
}

interface CdpMessage {
  id?: number
  method?: string
  result?: unknown
  error?: { message: string }
  params?: unknown
}

function cdpBase(): string {
  return process.env.PI_CHROME_CDP ?? "http://127.0.0.1:9333"
}

let cdpSocket: WebSocket | undefined
let connectingPromise: Promise<WebSocket> | undefined
let nextId = 1
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
const eventHandlers = new Map<string, Set<(params: Record<string, unknown>) => void>>()

async function pickTarget(): Promise<CdpTarget> {
  const base = cdpBase()
  const listRes = await fetch(`${base}/json/list`)
  if (!listRes.ok) throw new Error(`Failed to list CDP targets (HTTP ${listRes.status})`)
  const targets = (await listRes.json()) as CdpTarget[]
  const page = targets.find((t) => t.type === "page")
  if (page) return page
  const newRes = await fetch(`${base}/json/new?about:blank`, { method: "PUT" })
  if (!newRes.ok) throw new Error(`Failed to create CDP target (HTTP ${newRes.status})`)
  return (await newRes.json()) as CdpTarget
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.addEventListener("open", () => resolve(socket), { once: true })
    socket.addEventListener("error", () => reject(new Error(`Failed to open CDP socket: ${url}`)), { once: true })
    socket.addEventListener("message", (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as CdpMessage
      if (typeof data.id === "number") {
        const entry = pending.get(data.id)
        if (!entry) return
        pending.delete(data.id)
        if (data.error) entry.reject(new Error(data.error.message))
        else entry.resolve(data.result)
        return
      }
      if (data.method) {
        const set = eventHandlers.get(data.method)
        if (set) for (const fn of set) fn(data.params as Record<string, unknown>)
      }
    })
    socket.addEventListener("close", () => {
      if (cdpSocket === socket) cdpSocket = undefined
      const error = new Error("CDP socket closed before a reply was received")
      for (const [id, entry] of pending) {
        entry.reject(error)
        pending.delete(id)
      }
    })
  })
}

async function ensureSocket(): Promise<WebSocket> {
  if (cdpSocket && cdpSocket.readyState === WebSocket.OPEN) return cdpSocket
  // The single allowed reconnect: when no socket is open yet, or the previous
  // one closed. Concurrent callers share the same in-flight connection.
  if (connectingPromise) return connectingPromise
  connectingPromise = (async () => {
    try {
      const target = await pickTarget()
      const socket = await openSocket(target.webSocketDebuggerUrl)
      cdpSocket = socket
      return socket
    } finally {
      connectingPromise = undefined
    }
  })()
  return connectingPromise
}

async function send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const socket = await ensureSocket()
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

function waitForEvent(method: string, timeoutMs: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let maybe = eventHandlers.get(method)
    if (!maybe) {
      maybe = new Set<(params: Record<string, unknown>) => void>()
      eventHandlers.set(method, maybe)
    }
    const set = maybe
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let handler: (params: Record<string, unknown>) => void
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      set.delete(handler)
      if (set.size === 0) eventHandlers.delete(method)
      if (signal) signal.removeEventListener("abort", onAbort)
      action()
    }
    const onAbort = () => finish(() => reject(new Error(`Aborted while waiting for CDP event ${method}`)))
    handler = (params) => finish(() => resolve(params))
    set.add(handler)
    timer = setTimeout(() => finish(() => reject(new Error(`Timed out waiting for CDP event ${method}`))), timeoutMs)
    if (signal) signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function evaluate(expression: string): Promise<unknown> {
  const result = (await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })) as {
    result?: { value?: unknown }
    exceptionDetails?: { text?: string; exception?: { description?: string } }
  }
  if (result.exceptionDetails) {
    const d = result.exceptionDetails
    throw new Error(d.exception?.description ?? d.text ?? "Runtime.evaluate threw with no details")
  }
  return result.result?.value
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// WebMCP tool objects cannot cross the CDP boundary, so getTools() and the
// mapping run entirely inside one Runtime.evaluate expression that returns a
// JSON string; the tool then parses and formats it.
const WEBMCP_TOOLS_EXPR = `(async () => {
  const mc = document.modelContext;
  if (!mc) return JSON.stringify({ error: "WebMCP is unavailable on this page" });
  const tools = await mc.getTools();
  return JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })));
})()`

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "chrome_navigate",
    label: "Chrome Navigate",
    description:
      "Navigate the Chrome page to a URL, wait for the page load event, then report the final URL and document title.",
    parameters: Type.Object({ url: Type.String({ description: "URL to navigate the Chrome page to" }) }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      await send("Page.enable")
      const nav = (await send("Page.navigate", { url: params.url })) as { errorText?: string }
      if (nav.errorText) throw new Error(`Navigation to ${params.url} failed: ${nav.errorText}`)
      await waitForEvent("Page.loadEventFired", 30_000, signal)
      const info = (await evaluate("({ href: document.location.href, title: document.title })")) as {
        href: string
        title: string
      }
      return { content: [{ type: "text", text: `Loaded ${info.href}\nTitle: ${info.title}` }], details: {} }
    },
  })

  pi.registerTool({
    name: "chrome_eval",
    label: "Chrome Eval",
    description:
      "Escape hatch: evaluate an arbitrary JavaScript expression in the Chrome page and return the result as JSON. Use this when no dedicated tool fits the task.",
    parameters: Type.Object({ expression: Type.String({ description: "JavaScript expression to evaluate in the page" }) }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const value = await evaluate(params.expression)
      const text = JSON.stringify(value, null, 2) ?? "undefined"
      return { content: [{ type: "text", text }], details: {} }
    },
  })

  pi.registerTool({
    name: "chrome_text",
    label: "Chrome Text",
    description:
      "Return the visible text of the Chrome page (document.body.innerText), with blank-line runs collapsed and output capped at 4000 characters.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const raw = ((await evaluate("document.body.innerText")) as string | undefined) ?? ""
      const collapsed = raw.replace(/(\r?\n[ \t]*){2,}/g, "\n\n").trim()
      const cap = 4000
      const text = collapsed.length > cap ? `${collapsed.slice(0, cap)}\n…truncated` : collapsed
      return { content: [{ type: "text", text }], details: {} }
    },
  })

  pi.registerTool({
    name: "webmcp_tools",
    label: "WebMCP Tools",
    description:
      "List the tools the page exposes through WebMCP (document.modelContext): name, description, and input schema.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const raw = (await evaluate(WEBMCP_TOOLS_EXPR)) as string
      const parsed = JSON.parse(raw) as
        | { error?: string }
        | Array<{ name: string; description?: string; inputSchema?: unknown }>
      let text: string
      if (Array.isArray(parsed)) {
        text =
          parsed.length === 0
            ? "No WebMCP tools registered."
            : parsed
                .map((t) => `${t.name} — ${t.description ?? ""}\n${JSON.stringify(t.inputSchema ?? {}, null, 2)}`)
                .join("\n\n")
      } else {
        text = parsed.error ?? "WebMCP is unavailable"
      }
      return { content: [{ type: "text", text }], details: {} }
    },
  })

  pi.registerTool({
    name: "webmcp_execute",
    label: "WebMCP Execute",
    description:
      "Execute a tool the page exposes through WebMCP (document.modelContext) by name. Pass `args` as a JSON object string.",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the WebMCP tool to execute" }),
      args: Type.Optional(
        Type.String({
          description: 'Input arguments as a JSON object string, e.g. {"target":"tabs-1","value":"billing"}',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // args is already a JSON string; JSON.stringify encodes it as a JS string
      // literal so the original value reaches executeTool unchanged (never
      // parsed, never re-wrapped). name is encoded the same way for the find.
      const nameLit = JSON.stringify(params.name)
      const argsLit = JSON.stringify(params.args ?? "{}")
      const expr = `(async () => {
  const mc = document.modelContext;
  if (!mc) return "WebMCP is unavailable on this page";
  const tools = await mc.getTools();
  const tool = tools.find(t => t.name === ${nameLit});
  if (!tool) return "No WebMCP tool named " + ${nameLit} + ". Available tools: " + (tools.map(t => t.name).join(", ") || "(none)");
  return await mc.executeTool(tool, ${argsLit});
})()`
      const text = (await evaluate(expr)) as string
      return { content: [{ type: "text", text }], details: {} }
    },
  })
}
