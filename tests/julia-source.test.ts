import { describe, expect, it } from "vitest"

import {
  composeRuntimeSource,
  GLYPH_SOURCE,
  IMAGE_RUNTIME_SOURCE,
  validateRuntimeSource,
} from "../src/runtime/julia-source.ts"
import { SUPPORTED_TRANSFORMS as EXPORTED_SUPPORTED_TRANSFORMS } from "../src/runtime/transform-catalog.ts"
import { UNSUPPORTED_TRANSFORMS as EXPORTED_UNSUPPORTED_TRANSFORMS } from "../src/runtime/unsupported-source.ts"

const SUPPORTED_TRANSFORMS = [
  "invert",
  "gamma",
  "brightness",
  "contrast",
  "grayscale",
  "posterize",
  "threshold",
  "solarize",
  "pixelate",
] as const

const UNSUPPORTED_TRANSFORMS = [
  "gaussian",
  "box_blur",
  "median_blur",
  "motion_blur",
  "saturate",
  "desaturate",
  "sharpen",
  "edge_detect",
  "emboss",
  "noise",
  "crop",
  "crop_center",
  "crop_to",
  "scale_crop",
  "glow",
  "text_overlay",
  "save",
] as const

describe("VM-native Sokaris source", () => {
  it("defines the exact fourteen sibling glyph operators", () => {
    // Given
    const glyphs = ["▷", "🝡", "☽", "⊙", "∅", "✧", "⇉", "⚕", "☿", "⚹", "✦", "☥", "⚸", "𓇬"]

    // When
    const defined = glyphs.filter((glyph) => GLYPH_SOURCE.includes(glyph))

    // Then
    expect(defined).toEqual(glyphs)
  })

  it("keeps all supported image transforms in Julia source", () => {
    // Given
    const transforms = SUPPORTED_TRANSFORMS

    // When
    const definitions = transforms.map((name) => IMAGE_RUNTIME_SOURCE.includes(`function ${name}`))
    const composedSource = composeRuntimeSource("result = 42", [])

    // Then
    expect(definitions).toEqual(transforms.map(() => true))
    expect(composedSource).toContain(
      "Sokaris subset error: gaussian is not supported by SubsetJuliaVM v0.12.2.",
    )
  })

  it("exports exact supported and runtime-unsupported operation catalogs", () => {
    // Given / When
    // Given / When / Then
    expect(EXPORTED_SUPPORTED_TRANSFORMS).toEqual(SUPPORTED_TRANSFORMS)
    expect(EXPORTED_UNSUPPORTED_TRANSFORMS).toEqual(UNSUPPORTED_TRANSFORMS)
    expect(
      UNSUPPORTED_TRANSFORMS.map((name) =>
        composeRuntimeSource("result = 42", []).includes(`function ${name}(args...)`),
      ),
    ).toEqual(UNSUPPORTED_TRANSFORMS.map(() => true))
  })

  it("requires visible source to assign result and appends the hidden serializer", () => {
    // Given
    const userSource = "result = 21 ▷ (x -> x * 2)"

    // When
    const source = composeRuntimeSource(userSource, [])

    // Then
    expect(source).toContain(userSource)
    expect(source.indexOf(userSource)).toBeLessThan(source.indexOf("__SOKARIS_IMAGE_BEGIN__"))
    expect(() => composeRuntimeSource("21 * 2", [])).toThrow(
      "Visible Sokaris source must assign its final value to result",
    )
  })

  it("does not accept equality as a visible result assignment", () => {
    // Given
    const source = "result == 42"

    // When / Then
    expect(() => validateRuntimeSource(source)).toThrow(
      "Visible Sokaris source must assign its final value to result",
    )
  })
})
