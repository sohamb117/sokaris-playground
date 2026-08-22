import { RuntimeContractError } from "./errors.ts"

export type SourceRoute = "compiler" | "interpreter" | "image-migration-error"

const MAIN_FUNCTION = /\bfunction\s+main!\s*\(/
const IMAGE_LOAD = /\bload\s*\(/

export const routeSource = (source: string): SourceRoute => {
  if (MAIN_FUNCTION.test(source)) return "compiler"
  if (IMAGE_LOAD.test(source)) return "image-migration-error"
  return "interpreter"
}

export const validateRoutableSource = (source: string): SourceRoute => {
  const route = routeSource(source)
  if (route === "image-migration-error") {
    throw new RuntimeContractError(
      "Image programs must define main!(pixels::Vector{UInt8}); load(...) is available only in the legacy interpreter harness.",
    )
  }
  if (route === "interpreter" && !/(?:^|\n)\s*result\s*=(?!=)/.test(source)) {
    throw new RuntimeContractError(
      "Scalar compatibility source must assign its final value to result",
    )
  }
  return route
}
