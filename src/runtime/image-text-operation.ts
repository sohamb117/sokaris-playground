import { clampByte, type ImageOperation, pixelOffset } from "./image-operation-types.ts"

const GLYPHS: Readonly<Record<string, readonly number[]>> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "?": [14, 17, 1, 2, 4, 0, 4],
}

const glyph = (character: string): readonly number[] => GLYPHS[character] ?? GLYPHS["?"] ?? []

export const textOverlay: ImageOperation = ({ image, args, text }) => {
  const output = {
    filename: image.filename,
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
  }
  const scale = Math.max(1, Math.round((args[0] ?? 12) / 7))
  const startX = Math.max(0, Math.round(args[1] ?? 10))
  const startY = Math.max(0, Math.round(args[2] ?? 10))
  const alpha = Math.max(0, Math.min(1, args[3] ?? 0.7))
  let cursorX = startX
  let cursorY = startY
  for (const character of text) {
    if (character === "\n") {
      cursorX = startX
      cursorY += 8 * scale
      continue
    }
    const rows = glyph(character)
    for (let row = 0; row < rows.length; row += 1) {
      const bits = rows[row] ?? 0
      for (let column = 0; column < 5; column += 1) {
        if ((bits & (1 << (4 - column))) === 0) continue
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const x = cursorX + column * scale + sx
            const y = cursorY + row * scale + sy
            if (x >= output.width || y >= output.height) continue
            const offset = pixelOffset(output, x, y)
            for (let channel = 0; channel < 3; channel += 1) {
              output.data[offset + channel] = clampByte(
                (output.data[offset + channel] ?? 0) * (1 - alpha) + 255 * alpha,
              )
            }
            output.data[offset + 3] = 255
          }
        }
      }
    }
    cursorX += 6 * scale
  }
  return output
}
