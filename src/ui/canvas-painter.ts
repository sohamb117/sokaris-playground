import type { RuntimeImage } from "../runtime/types.ts"

export class CanvasImageError extends Error {
  readonly name = "CanvasImageError"
}

export const toRgbaBytes = (image: RuntimeImage): Uint8ClampedArray => {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height)) {
    throw new CanvasImageError("Image dimensions must be integers")
  }
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new CanvasImageError("Image dimensions do not match channel count")
  }
  const bytes = new Uint8ClampedArray(image.data.length)
  for (let index = 0; index < image.data.length; index += 1) {
    const channel = image.data[index]
    if (channel === undefined || !Number.isFinite(channel) || channel < 0 || channel > 1) {
      throw new CanvasImageError("Image channels must be finite values from 0 to 1")
    }
    bytes[index] = Math.round(channel * 255)
  }
  return bytes
}

export const paintImage = (canvas: HTMLCanvasElement, image: RuntimeImage): void => {
  const context = canvas.getContext("2d")
  if (context === null) throw new CanvasImageError("Canvas is unavailable")
  canvas.width = image.width
  canvas.height = image.height
  const imageData = context.createImageData(image.width, image.height)
  imageData.data.set(toRgbaBytes(image))
  context.putImageData(imageData, 0, 0)
}
