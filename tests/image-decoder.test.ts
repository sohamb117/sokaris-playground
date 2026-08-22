import { afterEach, describe, expect, it, vi } from "vitest"

import { decodeImage } from "../src/ui/image-decoder.ts"

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
  it("returns native dimensions and exact RGBA bytes", async () => {
    // Given
    const close = vi.fn()
    const drawImage = vi.fn()
    const pixels = new Uint8ClampedArray([0, 64, 128, 255, 1, 65, 129, 254])
    const context = {
      drawImage,
      getImageData: vi.fn(() => ({ data: pixels })),
    }
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: vi.fn(async () => ({ width: 2, height: 1, close })),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => context),
    })

    // When
    const image = await decodeImage(new File(["png"], "normal.png", { type: "image/png" }))
    // Then
    expect(image).toEqual({ filename: "normal.png", width: 2, height: 1, data: pixels })
    expect(image.data).toBeInstanceOf(Uint8ClampedArray)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0)
    expect(close).toHaveBeenCalledOnce()
  })

  it("requests browser-neutral decode options", async () => {
    // Given
    const createBitmap = vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() }))
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createBitmap,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      })),
    })
    const file = new File(["png"], "native.png", { type: "image/png" })

    // When
    await decodeImage(file)

    // Then
    expect(createBitmap).toHaveBeenCalledWith(file, {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
      imageOrientation: "none",
    })
  })
})
