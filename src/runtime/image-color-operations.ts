import { clampByte, copyImage, type ImageOperation, pixelOffset } from "./image-operation-types.ts"

const eachRgb =
  (operation: ImageOperation, transform: (value: number) => number): ImageOperation =>
  (request) => {
    const output = copyImage(operation(request))
    for (let offset = 0; offset < output.data.length; offset += 4) {
      output.data[offset] = clampByte(transform(output.data[offset] ?? 0))
      output.data[offset + 1] = clampByte(transform(output.data[offset + 1] ?? 0))
      output.data[offset + 2] = clampByte(transform(output.data[offset + 2] ?? 0))
    }
    return output
  }

const identity: ImageOperation = ({ image }) => copyImage(image)

const hsvSaturation =
  (amount: number): ImageOperation =>
  (request) => {
    const output = copyImage(request.image)
    for (let y = 0; y < output.height; y += 1) {
      for (let x = 0; x < output.width; x += 1) {
        const offset = pixelOffset(output, x, y)
        const r = (output.data[offset] ?? 0) / 255
        const g = (output.data[offset + 1] ?? 0) / 255
        const b = (output.data[offset + 2] ?? 0) / 255
        const maximum = Math.max(r, g, b)
        const minimum = Math.min(r, g, b)
        const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum
        const target = Math.max(0, Math.min(1, saturation * amount))
        const scale = saturation === 0 ? 0 : target / saturation
        output.data[offset] = clampByte((maximum + (r - maximum) * scale) * 255)
        output.data[offset + 1] = clampByte((maximum + (g - maximum) * scale) * 255)
        output.data[offset + 2] = clampByte((maximum + (b - maximum) * scale) * 255)
      }
    }
    return output
  }

export const COLOR_OPERATIONS: Readonly<Record<string, ImageOperation>> = {
  float: identity,
  clamp: identity,
  invert: eachRgb(identity, (value) => 255 - value),
  gamma: (request) =>
    eachRgb(identity, (value) => (value / 255) ** (request.args[0] ?? 1) * 255)(request),
  brightness: (request) =>
    eachRgb(identity, (value) => value + (request.args[0] ?? 0) * 255)(request),
  contrast: (request) =>
    eachRgb(identity, (value) => (value - 127.5) * (request.args[0] ?? 1) + 127.5)(request),
  saturate: (request) => hsvSaturation(request.args[0] ?? 1)(request),
  desaturate: (request) => hsvSaturation(1 - (request.args[0] ?? 0))(request),
  grayscale: (request) => {
    const output = copyImage(request.image)
    for (let offset = 0; offset < output.data.length; offset += 4) {
      const gray = clampByte(
        (output.data[offset] ?? 0) * 0.2126 +
          (output.data[offset + 1] ?? 0) * 0.7152 +
          (output.data[offset + 2] ?? 0) * 0.0722,
      )
      output.data[offset] = gray
      output.data[offset + 1] = gray
      output.data[offset + 2] = gray
    }
    return output
  },
  posterize: (request) => {
    const levels = Math.max(1, Math.round(request.args[0] ?? 2))
    return eachRgb(
      identity,
      (value) => Math.round((value / 255) * levels) * (255 / levels),
    )(request)
  },
  threshold: (request) => {
    const threshold = (request.args[0] ?? 0.5) * 255
    return eachRgb(identity, (value) => (value > threshold ? 255 : 0))(request)
  },
  solarize: (request) => {
    const threshold = (request.args[0] ?? 0.5) * 255
    return eachRgb(identity, (value) => (value > threshold ? 255 - value : value))(request)
  },
}
