import { RuntimeContractError } from "./errors.ts"
import type { RuntimeImage, RuntimeResult } from "./types.ts"

const SENTINEL_PATTERN = /__SOKARIS_IMAGE_BEGIN__\s*([\s\S]*?)\s*__SOKARIS_IMAGE_END__/g

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  return Reflect.get(value, key)
}

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== "string") throw new RuntimeContractError(`VM ${field} must be a string`)
  return value
}

const normalizeVmError = (message: string): string => {
  const match = message.match(/Sokaris subset error: .*\./)
  return match?.[0] ?? message
}

export const parseFinalImage = (output: string): RuntimeImage => {
  const blocks = Array.from(output.matchAll(SENTINEL_PATTERN))
  const finalBlock = blocks.at(-1)?.[1]
  if (finalBlock === undefined)
    throw new RuntimeContractError("VM output has no complete image block")
  const values = finalBlock.trim().split(",").map(Number)
  const width = values.at(0)
  const height = values.at(1)
  if (width === undefined || height === undefined) {
    throw new RuntimeContractError("Image sentinel must include width and height")
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new RuntimeContractError("Image sentinel dimensions must be positive safe integers")
  }
  const channels = values.slice(2)
  const expected = width * height * 4
  if (channels.length !== expected) {
    throw new RuntimeContractError(
      `Image sentinel expected ${expected} RGBA channels, received ${channels.length}`,
    )
  }
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 1)) {
    throw new RuntimeContractError("Image sentinel channels must be finite values in [0, 1]")
  }
  return {
    width,
    height,
    data: new Uint8ClampedArray(channels.map((channel) => Math.round(channel * 255))),
  }
}

export const parseExecutionResult = (raw: unknown): RuntimeResult => {
  const success = readProperty(raw, "success")
  const output = requireString(readProperty(raw, "output"), "output")
  if (success === false) {
    const message = requireString(readProperty(raw, "error_message"), "error_message")
    return { kind: "error", message: normalizeVmError(message), output }
  }
  if (success !== true) throw new RuntimeContractError("VM success must be a boolean")
  if (output.includes("__SOKARIS_IMAGE_BEGIN__")) {
    return { kind: "image", ...parseFinalImage(output) }
  }
  const value = readProperty(raw, "value")
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuntimeContractError("VM scalar value must be finite")
  }
  return { kind: "scalar", value, output }
}
