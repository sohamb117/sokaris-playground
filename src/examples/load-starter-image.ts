import starterImageUrl from "../assets/input.png?url"
import type { BrowserImageSource } from "../runtime/types.ts"
import { decodeImage } from "../ui/image-decoder.ts"
import { STARTER_FILENAME } from "./starter.ts"

export const loadStarterImage = async (): Promise<BrowserImageSource> => {
  const response = await fetch(starterImageUrl)
  if (!response.ok) throw new StarterImageLoadError(response.status)
  const blob = await response.blob()
  return decodeImage(new File([blob], STARTER_FILENAME, { type: blob.type }))
}

export class StarterImageLoadError extends Error {
  readonly name = "StarterImageLoadError"

  constructor(readonly status: number) {
    super(`Could not load ${STARTER_FILENAME} (${status})`)
  }
}
