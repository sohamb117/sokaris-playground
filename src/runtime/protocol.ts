import type { RuntimeArtifact, RuntimeRequest, RuntimeResult } from "./types.ts"

export type WorkerRunRequest = {
  readonly kind: "run"
  readonly runId: number
  readonly request: RuntimeRequest
}

export type WorkerResponse =
  | { readonly kind: "ready"; readonly version: string }
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
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void
  addEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: "error", listener: (event: ErrorEvent) => void): void
  removeEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void
  terminate(): void
}

export type RuntimeWorkerFactory = () => RuntimeWorkerLike

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  return Reflect.get(value, key)
}

const parseArtifact = (value: unknown): RuntimeArtifact => {
  const filename = readProperty(value, "filename")
  const width = readProperty(value, "width")
  const height = readProperty(value, "height")
  const data = readProperty(value, "data")
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !(data instanceof Uint8ClampedArray) ||
    data.length !== width * height * 4
  ) {
    throw new TypeError("Invalid runtime artifact")
  }
  return { filename, width, height, data }
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
    if (
      typeof width === "number" &&
      typeof height === "number" &&
      data instanceof Uint8ClampedArray
    ) {
      return { kind, width, height, data }
    }
  }
  if (kind === "artifacts") {
    const artifacts = readProperty(value, "artifacts")
    if (Array.isArray(artifacts)) return { kind, artifacts: artifacts.map(parseArtifact) }
  }
  throw new TypeError("Invalid runtime result")
}

export const runtimeResultTransfers = (result: RuntimeResult): Transferable[] => {
  if (result.kind === "image") return [result.data.buffer]
  if (result.kind === "artifacts") return result.artifacts.map(({ data }) => data.buffer)
  return []
}

export const prepareRuntimeResultTransfer = (
  result: RuntimeResult,
): { readonly result: RuntimeResult; readonly transfer: Transferable[] } => {
  if (result.kind === "image") {
    const data = new Uint8ClampedArray(result.data)
    return { result: { ...result, data }, transfer: [data.buffer] }
  }
  if (result.kind === "artifacts") {
    const artifacts = result.artifacts.map((artifact) => ({
      ...artifact,
      data: new Uint8ClampedArray(artifact.data),
    }))
    return {
      result: { kind: "artifacts", artifacts },
      transfer: artifacts.map(({ data }) => data.buffer),
    }
  }
  return { result, transfer: [] }
}

export const parseWorkerResponse = (value: unknown): WorkerResponse => {
  const kind = readProperty(value, "kind")
  const version = readProperty(value, "version")
  if (kind === "ready" && typeof version === "string" && version.length > 0) {
    return { kind, version }
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
