import type { RuntimeRequest, RuntimeResult } from "./types.ts"

export type WorkerRunRequest = {
  readonly kind: "run"
  readonly runId: number
  readonly request: RuntimeRequest
}

export type WorkerResponse =
  | { readonly kind: "ready"; readonly version: "0.12.2" }
  | { readonly kind: "result"; readonly runId: number; readonly result: RuntimeResult }
  | {
      readonly kind: "run-error"
      readonly runId: number
      readonly message: string
      readonly output: string
    }
  | { readonly kind: "fatal"; readonly message: string }

export interface RuntimeWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void
  terminate(): void
}

export type RuntimeWorkerFactory = () => RuntimeWorkerLike

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  return Reflect.get(value, key)
}

const parseRuntimeResult = (value: unknown): RuntimeResult => {
  const kind = readProperty(value, "kind")
  if (kind === "stale") return { kind }
  if (kind === "scalar") {
    const scalar = readProperty(value, "value")
    const output = readProperty(value, "output")
    if (typeof scalar === "number" && typeof output === "string") {
      return { kind, value: scalar, output }
    }
  }
  if (kind === "error") {
    const message = readProperty(value, "message")
    const output = readProperty(value, "output")
    if (typeof message === "string" && typeof output === "string") {
      return { kind, message, output }
    }
  }
  if (kind === "image") {
    const width = readProperty(value, "width")
    const height = readProperty(value, "height")
    const data = readProperty(value, "data")
    if (typeof width === "number" && typeof height === "number" && data instanceof Float64Array) {
      return { kind, width, height, data }
    }
  }
  throw new TypeError("Invalid runtime result")
}

export const parseWorkerResponse = (value: unknown): WorkerResponse => {
  const kind = readProperty(value, "kind")
  if (kind === "ready" && readProperty(value, "version") === "0.12.2") {
    return { kind, version: "0.12.2" }
  }
  if (kind === "fatal" && typeof readProperty(value, "message") === "string") {
    const message = readProperty(value, "message")
    if (typeof message === "string") return { kind, message }
  }
  const runId = readProperty(value, "runId")
  if (kind === "run-error" && typeof runId === "number") {
    const message = readProperty(value, "message")
    const output = readProperty(value, "output")
    if (typeof message === "string" && typeof output === "string") {
      return { kind, runId, message, output }
    }
  }
  const result = readProperty(value, "result")
  if (kind === "result" && typeof runId === "number" && result !== undefined) {
    return { kind, runId, result: parseRuntimeResult(result) }
  }
  throw new TypeError("Invalid runtime worker response")
}
