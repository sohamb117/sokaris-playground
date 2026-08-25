import { describe, expect, it } from "vitest"
import { STARTER_FILENAME, STARTER_SOURCE } from "../src/examples/starter.ts"

describe("starter content", () => {
  it("exports the bundled filename and exact raw starter program", () => {
    // Given / When
    const starter = { filename: STARTER_FILENAME, source: STARTER_SOURCE }

    // Then
    expect(starter).toEqual({
      filename: "inputs/input.png",
      source: `function invert(value::UInt8)::UInt8
    return UInt8(255 - value)
end

function main!(pixels::Vector{UInt8})
    index = 1
    channel = 1
    while index <= length(pixels)
        if channel < 4
            pixels[index] = invert(pixels[index])
        end
        channel = channel + 1
        if channel == 5
            channel = 1
        end
        index = index + 1
    end
end`,
    })
  })
})
