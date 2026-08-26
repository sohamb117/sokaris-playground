import initCompiler, {
  abi_version,
  compile_to_wasm,
} from "../vendor/subset-julia-compiler/subset_julia_vm_web.js"
import compilerWasmUrl from "../vendor/subset-julia-compiler/subset_julia_vm_web_bg.wasm?url"
import {
  compiledScriptImportsForSource,
  composeCompiledScriptSource,
} from "./compiled-script-source.ts"
import { CompilerModuleCache } from "./compiler-cache.ts"
import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "./compiler-contract.ts"
import { composeRuntimeSource } from "./julia-source.ts"
import { runtimeResultTransfers, type WorkerResponse, type WorkerRunRequest } from "./protocol.ts"
import { parseExecutionResult } from "./result-parser.ts"
import { executeCompiledScript } from "./script-executor.ts"
import { routeSource } from "./source-route.ts"
import type { BrowserImageSource, RuntimeResult } from "./types.ts"
import { BrowserImageFileSystem } from "./virtual-filesystem.ts"

const cache = new CompilerModuleCache(32)
const scriptCache = new Map<
  string,
  Promise<{
    readonly compiled: ReturnType<typeof parseCompilerResult>
    readonly module: WebAssembly.Module
  }>
>()
const filesystem = new BrowserImageFileSystem()

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

const compileScript = (
  source: string,
): Promise<{
  readonly compiled: ReturnType<typeof parseCompilerResult>
  readonly module: WebAssembly.Module
}> => {
  const key = `${abi_version()}\u0000script\u0000${source}`
  const cached = scriptCache.get(key)
  if (cached !== undefined) return cached
  const pending = (async () => {
    const raw = compile_to_wasm(composeCompiledScriptSource(source), {
      source_name: "playground.jl",
      opt_level: 2,
      entry_mode: "script",
      imports: compiledScriptImportsForSource(source).map((entry) => ({
        ...entry,
        params: [...entry.params],
      })),
    })
    const compiled = parseCompilerResult(raw)
    return { compiled, module: await WebAssembly.compile(compiled.bytes) }
  })()
  scriptCache.set(key, pending)
  if (scriptCache.size > 32) {
    const oldest = scriptCache.keys().next().value
    if (typeof oldest === "string") scriptCache.delete(oldest)
  }
  return pending
}

const runScript = async (
  source: string,
  images: readonly BrowserImageSource[],
): Promise<RuntimeResult> => {
  filesystem.replaceInputs(images)
  const { compiled, module } = await compileScript(source)
  return { kind: "artifacts", artifacts: await executeCompiledScript(module, compiled, filesystem) }
}

const execute = async (message: WorkerRunRequest): Promise<RuntimeResult> => {
  const route = routeSource(message.request.source)
  if (route === "interpreter") return runScalar(message.request.source)
  if (route === "script") return runScript(message.request.source, message.request.images)
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
      post({ kind: "result", runId, result }, runtimeResultTransfers(result))
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
