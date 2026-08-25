export type BrowserImageSource = {
  readonly filename: string
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export type RuntimeRequest = {
  readonly source: string
  readonly images: readonly BrowserImageSource[]
}

export type RuntimeImage = {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export type RuntimeArtifact = BrowserImageSource

export type RuntimeResult =
  | { readonly kind: "scalar"; readonly value: number; readonly output: string }
  | ({ readonly kind: "image" } & RuntimeImage)
  | { readonly kind: "artifacts"; readonly artifacts: readonly RuntimeArtifact[] }
  | { readonly kind: "error"; readonly message: string; readonly output: string }
  | { readonly kind: "stale" }
