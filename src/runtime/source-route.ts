import { RuntimeContractError } from "./errors.ts"

export type SourceRoute = "compiler" | "interpreter" | "script"

const MAIN_FUNCTION = /\bfunction\s+main!\s*\(/
const RESULT_ASSIGNMENT = /(?:^|\n)\s*result\s*=(?!=)/

export const routeSource = (source: string): SourceRoute => {
  if (MAIN_FUNCTION.test(source)) return "compiler"
  if (RESULT_ASSIGNMENT.test(source)) return "interpreter"
  return "script"
}

export const validateRoutableSource = (source: string): SourceRoute => {
  const route = routeSource(source)
  if (route === "interpreter" && !RESULT_ASSIGNMENT.test(source)) {
    throw new RuntimeContractError(
      "Scalar compatibility source must assign its final value to result",
    )
  }
  return route
}
