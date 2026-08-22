import initVm, {
  get_version,
  init,
  run_from_source_typed,
} from "../vendor/subset-julia/subset_julia_vm_web.js"
import wasmUrl from "../vendor/subset-julia/subset_julia_vm_web_bg.wasm?url"
import { VmVersionError } from "./errors.ts"
import { composeRuntimeSource } from "./julia-source.ts"
import type { WorkerResponse, WorkerRunRequest } from "./protocol.ts"
import { parseExecutionResult } from "./result-parser.ts"
import type { BrowserImageSource } from "./types.ts"

const post = (response: WorkerResponse, transfer: Transferable[] = []): void => {
  globalThis.postMessage(response, { transfer })
}

const readRunRequest = (value: unknown): WorkerRunRequest => {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid worker request")
  const kind = "kind" in value ? value.kind : undefined
  const runId = "runId" in value ? value.runId : undefined
  const request = "request" in value ? value.request : undefined
  if (
    kind !== "run" ||
    typeof runId !== "number" ||
    typeof request !== "object" ||
    request === null
  ) {
    throw new TypeError("Invalid worker run request")
  }
  const source = "source" in request ? request.source : undefined
  const images = "images" in request ? request.images : undefined
  if (typeof source !== "string" || !Array.isArray(images))
    throw new TypeError("Invalid runtime request")
  return { kind, runId, request: { source, images: images.map(readImage) } }
}

const readRunId = (value: unknown): number | undefined => {
  if (typeof value !== "object" || value === null || !("runId" in value)) return undefined
  return typeof value.runId === "number" ? value.runId : undefined
}

const readImage = (value: unknown): BrowserImageSource => {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid browser image")
  const filename = "filename" in value ? value.filename : undefined
  const width = "width" in value ? value.width : undefined
  const height = "height" in value ? value.height : undefined
  const data = "data" in value ? value.data : undefined
  if (
    typeof filename !== "string" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !(data instanceof Uint8ClampedArray)
  ) {
    throw new TypeError("Invalid browser image")
  }
  return { filename, width, height, data }
}

const initialize = async (): Promise<void> => {
  await initVm({ module_or_path: new URL(wasmUrl, globalThis.location.href) })
  init()
  const version = get_version()
  if (version !== "0.12.2") throw new VmVersionError(version)
  run_from_source_typed("1 + 1", 42n)
  post({ kind: "ready", version })
}

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  const runId = readRunId(event.data)
  if (runId === undefined) return
  try {
    const message = readRunRequest(event.data)
    const images = message.request.images.map((image) => ({
      ...image,
      data: Float64Array.from(image.data, (channel) => channel / 255),
    }))
    const source = composeRuntimeSource(message.request.source, images)
    const result = parseExecutionResult(run_from_source_typed(source, 42n))
    const transfer = result.kind === "image" ? [result.data.buffer] : []
    post({ kind: "result", runId: message.runId, result }, transfer)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runtime worker failure"
    post({ kind: "run-error", runId, message, output: "" })
  }
})

initialize().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown runtime initialization failure"
  post({ kind: "fatal", message })
})
