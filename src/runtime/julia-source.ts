import { RuntimeContractError } from "./errors.ts"
import { GLYPH_SOURCE } from "./glyph-source.ts"
import { IMAGE_RUNTIME_SOURCE } from "./image-runtime-source.ts"
import { marshalImageBindings, type NormalizedImageSource } from "./image-source.ts"
import { UNSUPPORTED_SOURCE } from "./unsupported-source.ts"

export { GLYPH_SOURCE, IMAGE_RUNTIME_SOURCE }

const RESULT_ASSIGNMENT = /(?:^|\n)\s*result\s*=(?!=)/

const SERIALIZER_SOURCE = String.raw`
if result isa BrowserImage
    print("__SOKARIS_IMAGE_BEGIN__\n")
    print(result.width)
    print(",")
    print(result.height)
    for channel in result.data
        print(",")
        print(channel)
    end
    print("\n__SOKARIS_IMAGE_END__\n")
end
result
`

export const validateRuntimeSource = (userSource: string): void => {
  if (!RESULT_ASSIGNMENT.test(userSource)) {
    throw new RuntimeContractError("Visible Sokaris source must assign its final value to result")
  }
}

export const composeRuntimeSource = (
  userSource: string,
  images: readonly NormalizedImageSource[],
): string => {
  validateRuntimeSource(userSource)
  return [
    IMAGE_RUNTIME_SOURCE,
    GLYPH_SOURCE,
    UNSUPPORTED_SOURCE,
    marshalImageBindings(images),
    userSource,
    SERIALIZER_SOURCE,
  ].join("\n")
}
