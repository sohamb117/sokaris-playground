import { copyImage, type ImageOperation, pixelOffset } from "./image-operation-types.ts"

const cropImage = (
  image: Parameters<ImageOperation>[0]["image"],
  xStart: number,
  yStart: number,
  width: number,
  height: number,
) => {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.round(xStart) - 1))
  const y0 = Math.max(0, Math.min(image.height - 1, Math.round(yStart) - 1))
  const outputWidth = Math.max(1, Math.min(image.width - x0, Math.round(width)))
  const outputHeight = Math.max(1, Math.min(image.height - y0, Math.round(height)))
  const data = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const source = pixelOffset(image, x0 + x, y0 + y)
      data.set(image.data.subarray(source, source + 4), (y * outputWidth + x) * 4)
    }
  }
  return { filename: image.filename, width: outputWidth, height: outputHeight, data }
}

const resizeNearest = (
  image: Parameters<ImageOperation>[0]["image"],
  width: number,
  height: number,
) => {
  const outputWidth = Math.max(1, Math.round(width))
  const outputHeight = Math.max(1, Math.round(height))
  const data = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / outputWidth))
      const sy = Math.min(image.height - 1, Math.floor((y * image.height) / outputHeight))
      const source = pixelOffset(image, sx, sy)
      data.set(image.data.subarray(source, source + 4), (y * outputWidth + x) * 4)
    }
  }
  return { filename: image.filename, width: outputWidth, height: outputHeight, data }
}

export const GEOMETRY_OPERATIONS: Readonly<Record<string, ImageOperation>> = {
  crop: ({ image, args }) =>
    cropImage(image, args[0] ?? 1, args[1] ?? 1, args[2] ?? 1, args[3] ?? 1),
  crop_center: ({ image, args }) => {
    const width = Math.min(image.width, Math.round(args[0] ?? image.width))
    const height = Math.min(image.height, Math.round(args[1] ?? image.height))
    return cropImage(
      image,
      Math.floor((image.width - width) / 2) + 1,
      Math.floor((image.height - height) / 2) + 1,
      width,
      height,
    )
  },
  crop_to: ({ image, args }) => {
    const height = Math.min(image.height, Math.round(args[0] ?? image.height))
    const width = Math.min(image.width, Math.round(args[1] ?? image.width))
    return cropImage(
      image,
      Math.floor((image.width - width) / 2) + 1,
      Math.floor((image.height - height) / 2) + 1,
      width,
      height,
    )
  },
  scale_crop: ({ image, args }) => {
    const targetHeight = Math.max(1, Math.round(args[0] ?? image.height))
    const targetWidth = Math.max(1, Math.round(args[1] ?? image.width))
    const scale = Math.max(targetHeight / image.height, targetWidth / image.width, 1)
    const resized = resizeNearest(image, image.width * scale, image.height * scale)
    return cropImage(
      resized,
      Math.floor((resized.width - targetWidth) / 2) + 1,
      Math.floor((resized.height - targetHeight) / 2) + 1,
      targetWidth,
      targetHeight,
    )
  },
  pixelate: ({ image, args }) => {
    const block = Math.max(1, Math.round(args[0] ?? 1))
    const output = copyImage(image)
    for (let y = 0; y < image.height; y += block) {
      for (let x = 0; x < image.width; x += block) {
        const sums = [0, 0, 0, 0]
        let count = 0
        for (let by = y; by < Math.min(image.height, y + block); by += 1) {
          for (let bx = x; bx < Math.min(image.width, x + block); bx += 1) {
            const offset = pixelOffset(image, bx, by)
            for (let channel = 0; channel < 4; channel += 1) {
              sums[channel] = (sums[channel] ?? 0) + (image.data[offset + channel] ?? 0)
            }
            count += 1
          }
        }
        for (let by = y; by < Math.min(image.height, y + block); by += 1) {
          for (let bx = x; bx < Math.min(image.width, x + block); bx += 1) {
            const offset = pixelOffset(output, bx, by)
            for (let channel = 0; channel < 4; channel += 1)
              output.data[offset + channel] = Math.round((sums[channel] ?? 0) / count)
          }
        }
      }
    }
    return output
  },
}
