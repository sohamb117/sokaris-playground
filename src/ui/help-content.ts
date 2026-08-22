import { RUNTIME_TIMEOUT_MS } from "../runtime/runtime-lifecycle.ts"
export type CompilerReference = {
  readonly name: string
  readonly signature: string
  readonly description: string
}

export const COMPILER_REFERENCE = [
  {
    name: "entry point",
    signature: "main!(pixels::Vector{UInt8})",
    description: "Mutate native row-major RGBA bytes in place.",
  },
  {
    name: "control flow",
    signature: "while / if / else",
    description: "Use static loops and branches over byte indices.",
  },
  {
    name: "helpers",
    signature: "function helper(value::UInt8)::UInt8",
    description: "Call directly typed helper functions from main!.",
  },
  {
    name: "byte access",
    signature: "pixels[index] / length(pixels)",
    description: "Read and write the active image's RGBA buffer.",
  },
] as const satisfies readonly CompilerReference[]

export const PROGRAM_RULES = [
  "Define main!(pixels::Vector{UInt8}) for image programs.",
  "The most recently inserted or replaced image is active.",
  "Pixels are native 0…255 RGBA bytes; preserve each alpha byte when appropriate.",
  "Source edits and valid image changes auto-run after 300ms.",
] as const

export const RUNTIME_LIMITS = [
  "The compiler implements a typed Julia subset, not full Julia.",
  "Images compile and execute at native resolution.",
  "Unsupported compiler constructs produce source diagnostics.",
  "Source without main! uses the scalar interpreter only when it does not call load(...).",
  `Execution stops after ${RUNTIME_TIMEOUT_MS / 1_000} seconds.`,
  "Compiler initialization stops after 60 seconds.",
] as const
