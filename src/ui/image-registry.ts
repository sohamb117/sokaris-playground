import type { BrowserImageSource } from "../runtime/types.ts"

export class ImageRegistry {
  private readonly images = new Map<string, BrowserImageSource>()

  replace(images: readonly BrowserImageSource[]): void {
    for (const image of images) this.images.set(image.filename, image)
  }

  list(): readonly BrowserImageSource[] {
    return Array.from(this.images.values())
  }
}
