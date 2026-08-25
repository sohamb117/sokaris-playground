import type { BrowserImageSource, RuntimeImage } from "./types.ts"

export type CompilerDiagnostic = {
  readonly kind: string
  readonly message: string
  readonly span?: {
    readonly startLine: number
    readonly startColumn: number
    readonly endLine: number
    readonly endColumn: number
  }
}

export type CompilerSuccess = {
  readonly bytes: Uint8Array
  readonly compilerVersion: string
  readonly abiVersion: 2
  readonly entryPoint: string | undefined
  readonly imports: readonly CompilerImport[]
}

export type CompilerImport = {
  readonly module: string
  readonly name: string
  readonly functionName: string
  readonly params: readonly string[]
  readonly result?: string
}

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  return Reflect.get(value, key)
}

const readDiagnostic = (value: unknown): CompilerDiagnostic => {
  const kind = readProperty(value, "kind")
  const message = readProperty(value, "message")
  if (typeof kind !== "string" || typeof message !== "string") {
    throw new TypeError("Compiler returned an invalid diagnostic")
  }
  const rawSpan = readProperty(value, "span")
  if (rawSpan === undefined) return { kind, message }
  const startLine = readProperty(rawSpan, "start_line")
  const startColumn = readProperty(rawSpan, "start_column")
  const endLine = readProperty(rawSpan, "end_line")
  const endColumn = readProperty(rawSpan, "end_column")
  if (
    typeof startLine !== "number" ||
    typeof startColumn !== "number" ||
    typeof endLine !== "number" ||
    typeof endColumn !== "number"
  ) {
    throw new TypeError("Compiler returned an invalid diagnostic span")
  }
  return { kind, message, span: { startLine, startColumn, endLine, endColumn } }
}

const readDiagnostics = (value: unknown): readonly CompilerDiagnostic[] => {
  const diagnostics = readProperty(value, "diagnostics")
  if (!Array.isArray(diagnostics)) throw new TypeError("Compiler returned invalid diagnostics")
  return diagnostics.map(readDiagnostic)
}

const readImport = (value: unknown): CompilerImport => {
  const module = readProperty(value, "module")
  const name = readProperty(value, "name")
  const functionName = readProperty(value, "function_name")
  const params = readProperty(value, "params")
  const result = readProperty(value, "result")
  if (
    typeof module !== "string" ||
    typeof name !== "string" ||
    typeof functionName !== "string" ||
    !Array.isArray(params) ||
    !params.every((param) => typeof param === "string") ||
    (result !== undefined && typeof result !== "string")
  ) {
    throw new TypeError("Compiler returned invalid import metadata")
  }
  return result === undefined
    ? { module, name, functionName, params }
    : { module, name, functionName, params, result }
}

const readImports = (value: unknown): readonly CompilerImport[] => {
  const imports = readProperty(value, "imports")
  if (imports === undefined) return []
  if (!Array.isArray(imports)) throw new TypeError("Compiler returned invalid import metadata")
  return imports.map(readImport)
}

export const formatCompilerDiagnostics = (value: unknown): string =>
  readDiagnostics(value)
    .map((diagnostic) => {
      const location = diagnostic.span
        ? ` (${diagnostic.span.startLine}:${diagnostic.span.startColumn}-${diagnostic.span.endLine}:${diagnostic.span.endColumn})`
        : ""
      return `${diagnostic.kind}: ${diagnostic.message}${location}`
    })
    .join("\n")

export const parseCompilerResult = (value: unknown): CompilerSuccess => {
  const success = readProperty(value, "success")
  const bytes = readProperty(value, "wasm_bytes")
  const compilerVersion = readProperty(value, "compiler_version")
  const abiVersion = readProperty(value, "abi_version")
  const entryPoint = readProperty(value, "entry_point")
  const imports = readImports(value)
  readDiagnostics(value)
  if (success !== true) throw new TypeError(formatCompilerDiagnostics(value))
  if (!(bytes instanceof Uint8Array) || !WebAssembly.validate(bytes)) {
    throw new TypeError("Compiler returned invalid WebAssembly bytes")
  }
  if (
    typeof compilerVersion !== "string" ||
    abiVersion !== 2 ||
    (entryPoint !== undefined && typeof entryPoint !== "string")
  ) {
    throw new TypeError("Compiler returned incompatible metadata")
  }
  return { bytes, compilerVersion, abiVersion, entryPoint, imports }
}

const DESCRIPTOR_BYTES = 56
const MAX_IMAGE_BYTES = 256 * 1024 * 1024

const requireFunction = (exports: WebAssembly.Exports, name: string): CallableFunction => {
  const value = exports[name]
  if (typeof value !== "function") throw new TypeError(`Compiled module is missing ${name}`)
  return value
}

export const executeCompiledImage = async (
  module: WebAssembly.Module,
  image: BrowserImageSource,
): Promise<RuntimeImage> => {
  if (
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1
  ) {
    throw new TypeError("Image dimensions must be positive safe integers")
  }
  const pixelCount = image.width * image.height
  if (!Number.isSafeInteger(pixelCount) || pixelCount > MAX_IMAGE_BYTES / 4) {
    throw new TypeError("Image exceeds the 256 MiB RGBA limit")
  }
  if (image.data.length !== pixelCount * 4) {
    throw new TypeError("Image dimensions do not match RGBA byte length")
  }
  const instance = await WebAssembly.instantiate(module, {})
  const memory = Reflect.get(instance.exports, "memory")
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new TypeError("Compiled module is missing memory")
  }
  const abiVersion = requireFunction(instance.exports, "__sjulia_wasm_abi_version")()
  if (abiVersion !== 2) throw new TypeError("Compiled module ABI version must be 2")
  const allocate = requireFunction(instance.exports, "__sjulia_alloc")
  const free = requireFunction(instance.exports, "__sjulia_free")
  const drop = requireFunction(instance.exports, "__sjulia_drop")
  const pixelPointer = Number(allocate(BigInt(image.data.length), 1))
  if (pixelPointer === 0) throw new TypeError("Compiled module could not allocate image bytes")
  let descriptorPointer = 0
  try {
    new Uint8Array(memory.buffer, pixelPointer, image.data.length).set(image.data)
    descriptorPointer = Number(allocate(BigInt(DESCRIPTOR_BYTES), 8))
    if (descriptorPointer === 0)
      throw new TypeError("Compiled module could not allocate image descriptor")
    const descriptor = new DataView(memory.buffer, descriptorPointer, DESCRIPTOR_BYTES)
    descriptor.setUint32(0, 2, true)
    descriptor.setUint32(4, 1, true)
    descriptor.setUint32(8, 1, true)
    descriptor.setUint32(12, 1, true)
    descriptor.setUint32(16, 0, true)
    descriptor.setUint32(20, 1, true)
    descriptor.setUint32(24, pixelPointer, true)
    descriptor.setUint32(28, 0, true)
    descriptor.setBigUint64(32, BigInt(image.data.length), true)
    descriptor.setBigUint64(40, BigInt(image.data.length), true)
    descriptor.setBigInt64(48, 1n, true)
    requireFunction(instance.exports, "main!")(descriptorPointer)
    const output = new Uint8Array(memory.buffer, pixelPointer, image.data.length)
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(output) }
  } finally {
    if (descriptorPointer !== 0) {
      drop(descriptorPointer)
      free(descriptorPointer)
    } else {
      free(pixelPointer)
    }
  }
}
