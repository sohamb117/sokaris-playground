import type { BrowserImageSource } from "../runtime/types.ts"

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
    bitmap = await createImageBitmap(file, {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
      imageOrientation: "none",
    })
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d")
    if (context === null) throw new ImageDecodeError(file.name)
    context.drawImage(bitmap, 0, 0)
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    return { filename: file.name, width: bitmap.width, height: bitmap.height, data }
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
