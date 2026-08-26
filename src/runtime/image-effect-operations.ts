import { FILTER_OPERATIONS } from "./image-filter-operations.ts"
import { clampByte, copyImage, type ImageOperation } from "./image-operation-types.ts"

const hashSeed = (text: string): number => {
  let hash = 2166136261
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 16777619)
  return hash >>> 0
}

const randomFactory = (seed: number): (() => number) => {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export const EFFECT_OPERATIONS: Readonly<Record<string, ImageOperation>> = {
  noise: (request) => {
    const output = copyImage(request.image)
    const random = randomFactory(hashSeed(`${request.image.filename}:${request.args[1] ?? 0}`))
    const amount = (request.args[0] ?? 0.1) * 255
    for (let offset = 0; offset < output.data.length; offset += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        const u1 = Math.max(Number.EPSILON, random())
        const u2 = random()
        const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        output.data[offset + channel] = clampByte(
          (output.data[offset + channel] ?? 0) + normal * amount,
        )
      }
    }
    return output
  },
  glow: (request) => {
    const blurred = FILTER_OPERATIONS["gaussian"]?.({ ...request, args: [request.args[0] ?? 5] })
    if (blurred === undefined) return copyImage(request.image)
    const output = copyImage(request.image)
    const opacity = request.args[1] ?? 0.5
    for (let offset = 0; offset < output.data.length; offset += 1) {
      output.data[offset] = clampByte(
        (output.data[offset] ?? 0) + (blurred.data[offset] ?? 0) * opacity,
      )
    }
    return output
  },
}
