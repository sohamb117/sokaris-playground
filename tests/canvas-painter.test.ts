import { describe, expect, it, vi } from "vitest"

import { paintImage, toRgbaBytes } from "../src/ui/canvas-painter.ts"

describe("canvas painter", () => {
  it("returns validated native bytes without conversion", () => {
    // Given
    const channels = new Uint8ClampedArray([0, 128, 255, 64])

    // When
    const result = toRgbaBytes({ width: 1, height: 1, data: channels })

    // Then
    expect(result).toEqual(new Uint8ClampedArray([0, 128, 255, 64]))
  })

  it("rejects a non-clamped pixel buffer", () => {
    // Given
    const channels = new Float64Array([0, 0.5, 1, 1])

    // When / Then
    expect(() => toRgbaBytes({ width: 1, height: 1, data: channels })).toThrow(
      "Image data must be a Uint8ClampedArray",
    )
  })

  it("puts native bytes directly into canvas image data", () => {
    // Given
    const pixels = new Uint8ClampedArray([12, 34, 56, 255])
    const imageData = { data: new Uint8ClampedArray(4) }
    const context = { createImageData: vi.fn(() => imageData), putImageData: vi.fn() }
    const canvas = document.createElement("canvas")
    Object.defineProperty(canvas, "getContext", { value: vi.fn(() => context) })

    // When
    paintImage(canvas, { width: 1, height: 1, data: pixels })

    // Then
    expect(imageData.data).toEqual(pixels)
    expect(context.putImageData).toHaveBeenCalledWith(imageData, 0, 0)
  })
})
