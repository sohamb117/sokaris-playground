import initCompiler, {
  abi_version,
  compile_to_wasm,
} from "../vendor/subset-julia-compiler/subset_julia_vm_web.js"
import compilerWasmUrl from "../vendor/subset-julia-compiler/subset_julia_vm_web_bg.wasm?url"
import { CompilerModuleCache } from "./compiler-cache.ts"
import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "./compiler-contract.ts"
import { composeRuntimeSource } from "./julia-source.ts"
import type { WorkerResponse, WorkerRunRequest } from "./protocol.ts"
import { parseExecutionResult } from "./result-parser.ts"
import { routeSource } from "./source-route.ts"
import type { BrowserImageSource, RuntimeResult } from "./types.ts"

const cache = new CompilerModuleCache(32)

const post = (response: WorkerResponse, transfer: Transferable[] = []): void => {
  globalThis.postMessage(response, { transfer })
}

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  return Reflect.get(value, key)
}

const readImage = (value: unknown): BrowserImageSource => {
  const filename = readProperty(value, "filename")
  const width = readProperty(value, "width")
  const height = readProperty(value, "height")
  const data = readProperty(value, "data")
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

const readRunRequest = (value: unknown): WorkerRunRequest => {
  const kind = readProperty(value, "kind")
  const runId = readProperty(value, "runId")
  const rawRequest = readProperty(value, "request")
  const source = readProperty(rawRequest, "source")
  const rawImages = readProperty(rawRequest, "images")
  if (kind !== "run" || typeof runId !== "number" || typeof source !== "string") {
    throw new TypeError("Invalid worker run request")
  }
  if (!Array.isArray(rawImages)) throw new TypeError("Invalid runtime images")
  return { kind, runId, request: { source, images: rawImages.map(readImage) } }
}

const compileImage = async (source: string, image: BrowserImageSource): Promise<RuntimeResult> => {
  const key = `${abi_version()}\u0000${source}`
  const module = await cache.get(key, async () => {
    const raw = compile_to_wasm(source, {
      source_name: "playground.jl",
      opt_level: 2,
      exports: [{ export_name: "main!", function_name: "main!", arg_types: ["Vector{UInt8}"] }],
    })
    const parsed = parseCompilerResult(raw)
    return WebAssembly.compile(parsed.bytes)
  })
  return { kind: "image", ...(await executeCompiledImage(module, image)) }
}

const runScalar = async (source: string): Promise<RuntimeResult> => {
  const interpreter = await import("../vendor/subset-julia/subset_julia_vm_web.js")
  await interpreter.default()
  interpreter.init()
  return parseExecutionResult(
    interpreter.run_from_source_typed(composeRuntimeSource(source, []), 42n),
  )
}

const execute = async (message: WorkerRunRequest): Promise<RuntimeResult> => {
  const route = routeSource(message.request.source)
  if (route === "image-migration-error") {
    return {
      kind: "error",
      message: "Image programs must define main!(pixels::Vector{UInt8}); remove load(...).",
      output: "",
    }
  }
  if (route === "interpreter") return runScalar(message.request.source)
  const image = message.request.images.at(-1)
  if (image === undefined) {
    return {
      kind: "error",
      message: "Compiled image programs require an active image.",
      output: "",
    }
  }
  return compileImage(message.request.source, image)
}

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  const runId = readProperty(event.data, "runId")
  if (typeof runId !== "number") return
  void (async () => {
    try {
      const result = await execute(readRunRequest(event.data))
      const transfer = result.kind === "image" ? [result.data.buffer] : []
      post({ kind: "result", runId, result }, transfer)
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unknown compiler worker failure"
      const message = raw.length > 0 ? raw : formatCompilerDiagnostics(error)
      post({ kind: "run-error", runId, message, output: "" })
    }
  })()
})

const initialize = async (): Promise<void> => {
  await initCompiler({ module_or_path: new URL(compilerWasmUrl, globalThis.location.href) })
  const abi = abi_version()
  if (abi !== 3) throw new TypeError(`Compiler package ABI version must be 3, received ${abi}`)
  post({ kind: "ready", version: `subset-julia-compiler/abi-${abi}` })
}

void initialize().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Compiler initialization failed"
  post({ kind: "fatal", message })
})
