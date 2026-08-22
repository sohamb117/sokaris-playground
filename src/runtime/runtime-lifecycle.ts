import type { WorkerRunRequest } from "./protocol.ts"
import type { RuntimeRequest, RuntimeResult } from "./types.ts"

export type PendingRun = {
  readonly runId: number
  readonly request: RuntimeRequest
  readonly resolve: (result: RuntimeResult) => void
}

export const RUNTIME_TIMEOUT_MESSAGE = "Sokaris execution timed out after 10 seconds."
export const RUNTIME_INITIALIZATION_TIMEOUT_MESSAGE =
  "Sokaris runtime failed to initialize within 60 seconds."
export const RUNTIME_WORKER_LOAD_ERROR_MESSAGE = "Sokaris runtime worker failed to load."
export const RUNTIME_WORKER_MESSAGE_ERROR_MESSAGE =
  "Sokaris runtime worker message could not be decoded."

export const RUNTIME_TIMEOUT_MS = 10_000
export const RUNTIME_INITIALIZATION_TIMEOUT_MS = 60_000

export const errorResult = (message: string): RuntimeResult => ({
  kind: "error",
  message,
  output: "",
})

export const prepareWorkerRun = (
  run: PendingRun,
): { readonly message: WorkerRunRequest; readonly transfer: Transferable[] } => {
  const images = run.request.images.map((image) => ({
    ...image,
    data: new Uint8ClampedArray(image.data),
  }))
  return {
    message: { kind: "run", runId: run.runId, request: { ...run.request, images } },
    transfer: images.map((image) => image.data.buffer),
  }
}

export const workerLoadErrorMessage = (event: ErrorEvent): string =>
  typeof event.message === "string" && event.message.trim().length > 0
    ? event.message
    : RUNTIME_WORKER_LOAD_ERROR_MESSAGE
