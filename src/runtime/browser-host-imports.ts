import type { BrowserImageSource } from "./types.ts"
import type { BrowserImageFileSystem, BrowserImageRun } from "./virtual-filesystem.ts"
import { VirtualFileNotFoundError, VirtualPathError } from "./virtual-filesystem.ts"

const ABI_VERSION = 2
const HEADER_BYTES = 40
const AXIS_BYTES = 16
const IMAGE_RANK = 3
const UINT8_TAG = 1
const MODULE_OWNED = 1
const READONLY = 2
const ALLOWED_FLAGS = MODULE_OWNED | READONLY

export type ImageDescriptor = {
  readonly flags: number
  readonly dimensions: readonly bigint[]
  readonly strides: readonly bigint[]
  readonly data: Uint8ClampedArray
}

type BrowserHostOptions = {
  readonly memory: WebAssembly.Memory
  readonly allocate: (size: bigint, alignment: number) => number
  readonly filesystem: BrowserImageFileSystem
  readonly run: BrowserImageRun
}

const checkedNumber = (value: bigint, context: string): number => {
  const converted = Number(value)
  if (!Number.isSafeInteger(converted) || converted < 0) {
    throw new TypeError(`${context} exceeds the safe integer range`)
  }
  return converted
}

const checkedRange = (
  memory: WebAssembly.Memory,
  pointer: number,
  length: number,
  context: string,
): void => {
  const end = pointer + length
  if (
    !Number.isSafeInteger(pointer) ||
    pointer < 0 ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    !Number.isSafeInteger(end) ||
    end > memory.buffer.byteLength
  ) {
    throw new TypeError(`${context} exceeds Wasm memory`)
  }
}

const readPath = (memory: WebAssembly.Memory, viewPointer: number): string => {
  checkedRange(memory, viewPointer, 8, "String view")
  const view = new DataView(memory.buffer)
  const pointer = view.getUint32(viewPointer, true)
  const length = view.getUint32(viewPointer + 4, true)
  checkedRange(memory, pointer, length, "String data")
  return new TextDecoder("utf-8", { fatal: true }).decode(
    new Uint8Array(memory.buffer, pointer, length),
  )
}

export const readImageDescriptor = (
  memory: WebAssembly.Memory,
  pointer: number,
): ImageDescriptor => {
  if (pointer === 0 || pointer % 8 !== 0) throw new TypeError("Invalid image descriptor pointer")
  checkedRange(memory, pointer, HEADER_BYTES + IMAGE_RANK * AXIS_BYTES, "Image descriptor")
  const view = new DataView(memory.buffer)
  const flags = view.getUint32(pointer + 4, true)
  const rank = view.getUint32(pointer + 20, true)
  if (
    view.getUint32(pointer, true) !== ABI_VERSION ||
    (flags & ~ALLOWED_FLAGS) !== 0 ||
    view.getUint32(pointer + 8, true) !== UINT8_TAG ||
    view.getUint32(pointer + 12, true) !== 1 ||
    view.getUint32(pointer + 16, true) !== 0 ||
    rank !== IMAGE_RANK ||
    view.getUint32(pointer + 28, true) !== 0
  ) {
    throw new TypeError("Invalid ABI2 image descriptor")
  }
  const dimensions: bigint[] = []
  const strides: bigint[] = []
  let count = 1n
  let maximumOffset = 0n
  for (let axis = 0; axis < IMAGE_RANK; axis += 1) {
    const offset = pointer + HEADER_BYTES + axis * AXIS_BYTES
    const dimension = view.getBigUint64(offset, true)
    const stride = view.getBigInt64(offset + 8, true)
    if (stride < 0n) throw new TypeError("Image descriptor has a negative stride")
    dimensions.push(dimension)
    strides.push(stride)
    count *= dimension
    if (dimension > 0n) maximumOffset += (dimension - 1n) * stride
  }
  if (view.getBigUint64(pointer + 32, true) !== count || dimensions[0] !== 4n) {
    throw new TypeError("Image descriptor shape is invalid")
  }
  const dataPointer = view.getUint32(pointer + 24, true)
  const extent = count === 0n ? 0 : checkedNumber(maximumOffset + 1n, "Image extent")
  checkedRange(memory, dataPointer, extent, "Image data")
  const width = checkedNumber(dimensions[1] ?? 0n, "Image width")
  const height = checkedNumber(dimensions[2] ?? 0n, "Image height")
  if (width < 1 || height < 1) throw new TypeError("Image dimensions must be positive")
  const data = new Uint8ClampedArray(width * height * 4)
  const source = new Uint8Array(memory.buffer)
  const channelStride = strides[0] ?? 0n
  const xStride = strides[1] ?? 0n
  const yStride = strides[2] ?? 0n
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        const sourceOffset =
          BigInt(channel) * channelStride + BigInt(x) * xStride + BigInt(y) * yStride
        data[(y * width + x) * 4 + channel] =
          source[dataPointer + checkedNumber(sourceOffset, "Image offset")] ?? 0
      }
    }
  }
  return { flags, dimensions, strides, data }
}

const writeImageDescriptor = (
  memory: WebAssembly.Memory,
  allocate: BrowserHostOptions["allocate"],
  pointer: number,
  image: BrowserImageSource,
): void => {
  checkedRange(memory, pointer, HEADER_BYTES + IMAGE_RANK * AXIS_BYTES, "Output descriptor")
  const dataPointer = allocate(BigInt(image.data.length), 1)
  if (dataPointer === 0) throw new RangeError("Could not allocate image data")
  new Uint8Array(memory.buffer, dataPointer, image.data.length).set(image.data)
  const view = new DataView(memory.buffer)
  view.setUint32(pointer, ABI_VERSION, true)
  view.setUint32(pointer + 4, MODULE_OWNED, true)
  view.setUint32(pointer + 8, UINT8_TAG, true)
  view.setUint32(pointer + 12, 1, true)
  view.setUint32(pointer + 16, 0, true)
  view.setUint32(pointer + 20, IMAGE_RANK, true)
  view.setUint32(pointer + 24, dataPointer, true)
  view.setUint32(pointer + 28, 0, true)
  view.setBigUint64(pointer + 32, BigInt(image.data.length), true)
  const axes = [
    [4, 1],
    [image.width, 4],
    [image.height, image.width * 4],
  ] as const
  axes.forEach(([dimension, stride], axis) => {
    const offset = pointer + HEADER_BYTES + axis * AXIS_BYTES
    view.setBigUint64(offset, BigInt(dimension), true)
    view.setBigInt64(offset + 8, BigInt(stride), true)
  })
}

export const createBrowserHostImports = (options: BrowserHostOptions) => ({
  sjulia_host: {
    load: (pathView: number, _layout: bigint, output: bigint): bigint => {
      try {
        writeImageDescriptor(
          options.memory,
          options.allocate,
          checkedNumber(output, "Output pointer"),
          options.filesystem.load(readPath(options.memory, pathView)),
        )
        return 0n
      } catch (error) {
        if (error instanceof VirtualFileNotFoundError) return 2n
        if (error instanceof VirtualPathError || error instanceof TypeError) return 1n
        if (error instanceof RangeError) return 6n
        return 5n
      }
    },
    save: (pathView: number, descriptor: bigint): bigint => {
      try {
        const path = readPath(options.memory, pathView)
        const image = readImageDescriptor(
          options.memory,
          checkedNumber(descriptor, "Image descriptor pointer"),
        )
        options.run.save(path, {
          filename: path,
          width: checkedNumber(image.dimensions[1] ?? 0n, "Image width"),
          height: checkedNumber(image.dimensions[2] ?? 0n, "Image height"),
          data: image.data,
        })
        return 0n
      } catch (error) {
        if (error instanceof VirtualPathError || error instanceof TypeError) return 1n
        return 5n
      }
    },
  },
})
