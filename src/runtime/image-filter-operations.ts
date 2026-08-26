import { clampByte, copyImage, type ImageOperation, pixelOffset } from "./image-operation-types.ts"

type Kernel = {
  readonly width: number
  readonly height: number
  readonly values: readonly number[]
}

const convolve =
  (kernel: Kernel): ImageOperation =>
  (request) => {
    const output = copyImage(request.image)
    const radiusX = Math.floor(kernel.width / 2)
    const radiusY = Math.floor(kernel.height / 2)
    for (let y = 0; y < output.height; y += 1) {
      for (let x = 0; x < output.width; x += 1) {
        const target = pixelOffset(output, x, y)
        for (let channel = 0; channel < 3; channel += 1) {
          let sum = 0
          for (let ky = 0; ky < kernel.height; ky += 1) {
            for (let kx = 0; kx < kernel.width; kx += 1) {
              const sx = Math.max(0, Math.min(output.width - 1, x + kx - radiusX))
              const sy = Math.max(0, Math.min(output.height - 1, y + ky - radiusY))
              sum +=
                (request.image.data[pixelOffset(request.image, sx, sy) + channel] ?? 0) *
                (kernel.values[ky * kernel.width + kx] ?? 0)
            }
          }
          output.data[target + channel] = clampByte(sum)
        }
      }
    }
    return output
  }

const boxKernel = (size: number): Kernel => {
  const width = Math.max(1, Math.round(size))
  return { width, height: width, values: Array(width * width).fill(1 / (width * width)) }
}

const gaussianKernel = (sigma: number): Kernel => {
  const safeSigma = Math.max(0.1, sigma)
  const radius = Math.max(1, Math.ceil(safeSigma * 3))
  const width = radius * 2 + 1
  const values: number[] = []
  let total = 0
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const value = Math.exp(-(x * x + y * y) / (2 * safeSigma * safeSigma))
      values.push(value)
      total += value
    }
  }
  return { width, height: width, values: values.map((value) => value / total) }
}

const median: ImageOperation = (request) => {
  const size = Math.max(1, Math.round(request.args[0] ?? 3))
  const radius = Math.floor(size / 2)
  const output = copyImage(request.image)
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const target = pixelOffset(output, x, y)
      for (let channel = 0; channel < 3; channel += 1) {
        const values: number[] = []
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sx = Math.max(0, Math.min(output.width - 1, x + dx))
            const sy = Math.max(0, Math.min(output.height - 1, y + dy))
            values.push(request.image.data[pixelOffset(request.image, sx, sy) + channel] ?? 0)
          }
        }
        values.sort((left, right) => left - right)
        output.data[target + channel] = values[Math.floor(values.length / 2)] ?? 0
      }
    }
  }
  return output
}

export const FILTER_OPERATIONS: Readonly<Record<string, ImageOperation>> = {
  gaussian: (request) => convolve(gaussianKernel(request.args[0] ?? 1))(request),
  box_blur: (request) => convolve(boxKernel(request.args[0] ?? 3))(request),
  median_blur: median,
  motion_blur: (request) => {
    const length = Math.max(1, Math.round(request.args[0] ?? 3))
    const diagonal = (request.args[1] ?? 0) !== 0
    const values = Array(length * length).fill(0)
    for (let index = 0; index < length; index += 1) {
      values[diagonal ? index * length + index : Math.floor(length / 2) * length + index] =
        1 / length
    }
    return convolve({ width: length, height: length, values })(request)
  },
  sharpen: (request) => {
    const amount = request.args[0] ?? 1
    return convolve({
      width: 3,
      height: 3,
      values: [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0],
    })(request)
  },
  edge_detect: convolve({ width: 3, height: 3, values: [-1, 0, 1, -2, 0, 2, -1, 0, 1] }),
  emboss: convolve({ width: 3, height: 3, values: [-2, -1, 0, -1, 1, 1, 0, 1, 2] }),
}
