import type { BrowserImageSource } from "../runtime/types.ts"

const MAX_PREVIEW_DIMENSION = 32

export type PreviewSize = {
  readonly width: number
  readonly height: number
}

export class ImageSizeError extends Error {
  readonly name = "ImageSizeError"

  constructor() {
    super("Image dimensions must be positive safe integers")
  }
}

export const previewSize = (sourceWidth: number, sourceHeight: number): PreviewSize => {
  if (
    !Number.isSafeInteger(sourceWidth) ||
    !Number.isSafeInteger(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    throw new ImageSizeError()
  }
  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(sourceWidth, sourceHeight))
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

export class ImageDecodeError extends Error {
  readonly name = "ImageDecodeError"

  constructor(readonly filename: string) {
    super(`Could not decode ${filename}`)
  }
}

export const decodeImage = async (file: File): Promise<BrowserImageSource> => {
  if (!file.type.startsWith("image/")) throw new ImageDecodeError(file.name)
  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    const target = previewSize(bitmap.width, bitmap.height)
    const canvas = document.createElement("canvas")
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext("2d")
    if (context === null) throw new ImageDecodeError(file.name)
    context.drawImage(bitmap, 0, 0, target.width, target.height)
    const bytes = context.getImageData(0, 0, target.width, target.height).data
    const data = new Float64Array(bytes.length)
    for (let index = 0; index < bytes.length; index += 1) {
      const value = bytes[index]
      if (value !== undefined) data[index] = value / 255
    }
    return { filename: file.name, ...target, data }
  } catch (error) {
    if (error instanceof ImageDecodeError) throw error
    throw new ImageDecodeError(file.name)
  } finally {
    bitmap?.close()
  }
}

export const decodeImages = async (
  files: FileList | readonly File[],
): Promise<readonly BrowserImageSource[]> => Promise.all(Array.from(files).map(decodeImage))
