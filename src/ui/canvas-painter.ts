import type { RuntimeImage } from "../runtime/types.ts"

export class CanvasImageError extends Error {
  readonly name = "CanvasImageError"
}

export const toRgbaBytes = (value: unknown): Uint8ClampedArray => {
  if (typeof value !== "object" || value === null) {
    throw new CanvasImageError("Image data must be an object")
  }
  const width = "width" in value ? value.width : undefined
  const height = "height" in value ? value.height : undefined
  const data = "data" in value ? value.data : undefined
  if (!(data instanceof Uint8ClampedArray)) {
    throw new CanvasImageError("Image data must be a Uint8ClampedArray")
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new CanvasImageError("Image dimensions must be integers")
  }
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4
  ) {
    throw new CanvasImageError("Image dimensions do not match channel count")
  }
  return data
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
