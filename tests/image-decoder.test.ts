import { afterEach, describe, expect, it, vi } from "vitest"

import { marshalImageBindings } from "../src/runtime/image-source.ts"
import { decodeImage, previewSize } from "../src/ui/image-decoder.ts"

const originalCreateImageBitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap")
const originalGetContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "getContext",
)

afterEach(() => {
  if (originalCreateImageBitmap === undefined) {
    Reflect.deleteProperty(globalThis, "createImageBitmap")
  } else {
    Object.defineProperty(globalThis, "createImageBitmap", originalCreateImageBitmap)
  }
  if (originalGetContext === undefined) {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, "getContext")
  } else {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", originalGetContext)
  }
})

describe("browser image decoding", () => {
  it("bounds an 800x768 image before marshalling VM numeric literals", async () => {
    // Given
    const close = vi.fn()
    const drawImage = vi.fn()
    const context = {
      drawImage,
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
    }
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: vi.fn(async () => ({ width: 800, height: 768, close })),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => context),
    })

    // When
    const image = await decodeImage(new File(["png"], "normal.png", { type: "image/png" }))
    const binding = marshalImageBindings([image])

    // Then
    expect(image).toMatchObject({ width: 32, height: 31 })
    expect(image.data).toHaveLength(32 * 31 * 4)
    expect(binding.length).toBeLessThan(20_000)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 32, 31)
    expect(close).toHaveBeenCalledOnce()
  })

  it.each([
    { source: { width: 800, height: 768 }, target: { width: 32, height: 31 } },
    { source: { width: 768, height: 800 }, target: { width: 31, height: 32 } },
    { source: { width: 400, height: 400 }, target: { width: 32, height: 32 } },
    { source: { width: 24, height: 16 }, target: { width: 24, height: 16 } },
  ])("fits $source into the VM preview as $target", ({ source, target }) => {
    // Given / When
    const size = previewSize(source.width, source.height)

    // Then
    expect(size).toEqual(target)
  })

  it.each([
    [0, 1],
    [1, 0],
    [-1, 1],
    [1.5, 1],
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
  ])("rejects invalid source dimensions %s x %s", (width, height) => {
    // Given / When
    const size = () => previewSize(width, height)

    // Then
    expect(size).toThrow("Image dimensions must be positive safe integers")
  })
})
