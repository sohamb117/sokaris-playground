type HarnessImage = {
  readonly filename: string
  readonly width: number
  readonly height: number
  readonly data: readonly number[]
}

type HarnessResult =
  | { readonly kind: "scalar"; readonly value: number; readonly output: string }
  | {
      readonly kind: "image"
      readonly width: number
      readonly height: number
      readonly data: number[]
    }
  | { readonly kind: "error"; readonly message: string; readonly output: string }

interface Window {
  __sokarisRuntime?: {
    readonly ready: boolean
    run(source: string, images: readonly HarnessImage[]): Promise<HarnessResult>
  }
}
