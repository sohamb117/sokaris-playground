import { describe, expect, it } from "vitest"

import { applyImageOperation, IMAGE_OPERATION_NAMES } from "../src/runtime/image-operations.ts"

const image = {
  filename: "fixture.png",
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    0, 64, 128, 255, 255, 128, 64, 255, 32, 96, 160, 255, 224, 192, 16, 255,
  ]),
}

describe("compiled image operations", () => {
  it("registers every Imhotep image operation", () => {
    expect(IMAGE_OPERATION_NAMES).toEqual([
      "box_blur",
      "brightness",
      "clamp",
      "contrast",
      "crop",
      "crop_center",
      "crop_to",
      "desaturate",
      "edge_detect",
      "emboss",
      "float",
      "gamma",
      "gaussian",
      "glow",
      "grayscale",
      "invert",
      "median_blur",
      "motion_blur",
      "noise",
      "pixelate",
      "posterize",
      "saturate",
      "scale_crop",
      "sharpen",
      "solarize",
      "text_overlay",
      "threshold",
    ])
  })

  it("preserves alpha and dimensions for color and filter operations", () => {
    for (const name of ["invert", "gamma", "gaussian", "median_blur", "sharpen", "glow"]) {
      const output = applyImageOperation({ name, image, args: [1, 0.5], text: "" })
      expect([output.width, output.height]).toEqual([2, 2])
      expect(Array.from(output.data).filter((_, index) => index % 4 === 3)).toEqual([
        255, 255, 255, 255,
      ])
    }
  })

  it("produces deterministic noise for the same image and seed", () => {
    const request = { name: "noise", image, args: [0.1, 42], text: "" } as const
    expect(applyImageOperation(request).data).toEqual(applyImageOperation(request).data)
  })

  it("changes dimensions for crop and scale crop", () => {
    expect(
      applyImageOperation({ name: "crop", image, args: [1, 1, 1, 2], text: "" }),
    ).toMatchObject({ width: 1, height: 2 })
    expect(
      applyImageOperation({ name: "scale_crop", image, args: [3, 4], text: "" }),
    ).toMatchObject({ width: 4, height: 3 })
  })

  it("renders deterministic text pixels", () => {
    const output = applyImageOperation({
      name: "text_overlay",
      image: { ...image, width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) },
      args: [7, 0, 0, 1],
      text: "?",
    })
    expect(Array.from(output.data).some((value) => value === 255)).toBe(true)
  })
})
