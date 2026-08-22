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
  readonly abiVersion: 1
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
  readDiagnostics(value)
  if (success !== true) throw new TypeError(formatCompilerDiagnostics(value))
  if (!(bytes instanceof Uint8Array) || !WebAssembly.validate(bytes)) {
    throw new TypeError("Compiler returned invalid WebAssembly bytes")
  }
  if (typeof compilerVersion !== "string" || abiVersion !== 1) {
    throw new TypeError("Compiler returned incompatible metadata")
  }
  return { bytes, compilerVersion, abiVersion }
}

const DESCRIPTOR_POINTER = 32
const PIXEL_POINTER = 64
const DESCRIPTOR_BYTES = 20
const PAGE_BYTES = 65_536
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
  const requiredBytes = PIXEL_POINTER + image.data.length
  if (memory.buffer.byteLength < requiredBytes) {
    memory.grow(Math.ceil((requiredBytes - memory.buffer.byteLength) / PAGE_BYTES))
  }
  const descriptor = new DataView(memory.buffer, DESCRIPTOR_POINTER, DESCRIPTOR_BYTES)
  descriptor.setUint32(0, 1, true)
  descriptor.setUint32(4, PIXEL_POINTER, true)
  descriptor.setUint32(8, image.data.length, true)
  descriptor.setUint32(12, 1, true)
  descriptor.setUint32(16, 1, true)
  new Uint8Array(memory.buffer, PIXEL_POINTER, image.data.length).set(image.data)
  const abiVersion = requireFunction(instance.exports, "__sjulia_wasm_abi_version")()
  if (abiVersion !== 1) throw new TypeError("Compiled module ABI version must be 1")
  requireFunction(instance.exports, "main!")(DESCRIPTOR_POINTER)
  if (memory.buffer.byteLength < requiredBytes) {
    throw new TypeError("Compiled module changed the image byte length")
  }
  const output = new Uint8Array(memory.buffer, PIXEL_POINTER, image.data.length)
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(output) }
}
