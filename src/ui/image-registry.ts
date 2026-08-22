import type { BrowserImageSource } from "../runtime/types.ts"

export class ImageRegistry {
  private readonly images = new Map<string, BrowserImageSource>()
  private activeImage: BrowserImageSource | undefined

  replace(images: readonly BrowserImageSource[]): void {
    for (const image of images) {
      this.images.set(image.filename, image)
      this.activeImage = image
    }
  }

  list(): readonly BrowserImageSource[] {
    return Array.from(this.images.values())
  }

  active(): BrowserImageSource | undefined {
    return this.activeImage
  }
}
