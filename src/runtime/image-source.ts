import { RuntimeContractError } from "./errors.ts"

export type NormalizedImageSource = {
  readonly filename: string
  readonly width: number
  readonly height: number
  readonly data: Float64Array
}

const escapeJuliaString = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("$", "\\$")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t")

const validateImage = (image: NormalizedImageSource): void => {
  if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)) {
    throw new RuntimeContractError("Image dimensions must be safe integers")
  }
  if (image.width < 1 || image.height < 1) {
    throw new RuntimeContractError("Image dimensions must be positive")
  }
  if (image.data.length !== image.width * image.height * 4) {
    throw new RuntimeContractError("RGBA channel count must equal width * height * 4")
  }
  for (const channel of image.data) {
    if (!Number.isFinite(channel) || channel < 0 || channel > 1) {
      throw new RuntimeContractError("RGBA channels must be finite values in [0, 1]")
    }
  }
}

export const marshalImageBindings = (images: readonly NormalizedImageSource[]): string => {
  const filenames = new Set<string>()
  const branches: string[] = []
  for (const image of images) {
    validateImage(image)
    if (filenames.has(image.filename)) {
      throw new RuntimeContractError(`Duplicate image filename: ${image.filename}`)
    }
    filenames.add(image.filename)
    branches.push(
      `if name == "${escapeJuliaString(image.filename)}"\n` +
        `return copy_image(BrowserImage(${image.width}, ${image.height}, Float64[${Array.from(image.data).join(", ")}]))\n` +
        "end",
    )
  }
  return `function load(name)\n${branches.join("\n")}\nerror("Sokaris subset error: image '" * name * "' is not loaded.")\nend`
}
