import type { BrowserImageSource } from "./types.ts"

export type ImageOperationRequest = {
  readonly name: string
  readonly image: BrowserImageSource
  readonly args: readonly number[]
  readonly text: string
}

export type ImageOperation = (request: ImageOperationRequest) => BrowserImageSource

export const copyImage = (image: BrowserImageSource): BrowserImageSource => ({
  filename: image.filename,
  width: image.width,
  height: image.height,
  data: new Uint8ClampedArray(image.data),
})

export const clampByte = (value: number): number => Math.round(Math.max(0, Math.min(255, value)))

export const pixelOffset = (image: BrowserImageSource, x: number, y: number): number =>
  (y * image.width + x) * 4
