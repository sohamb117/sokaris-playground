import type { BrowserImageSource } from "../runtime/types.ts"
import type { ArtifactProvenance } from "./artifact-list.ts"

export type SelectedArtifact = {
  readonly provenance: ArtifactProvenance
  readonly image: BrowserImageSource
}

export class ImageRegistry {
  private readonly images = new Map<string, BrowserImageSource>()
  private outputImages = new Map<string, BrowserImageSource>()
  private selectedArtifact: SelectedArtifact | undefined

  replace(images: readonly BrowserImageSource[]): void {
    for (const image of images) {
      this.images.set(image.filename, image)
      this.selectedArtifact = { provenance: "input", image }
    }
  }

  replaceOutputs(images: readonly BrowserImageSource[]): void {
    this.outputImages = new Map(images.map((image) => [image.filename, image]))
    const selected = images.at(-1)
    this.selectedArtifact =
      selected === undefined ? undefined : { provenance: "output", image: selected }
  }

  list(): readonly BrowserImageSource[] {
    return Array.from(this.images.values())
  }

  active(): BrowserImageSource | undefined {
    return this.selectedArtifact?.image
  }

  outputs(): readonly BrowserImageSource[] {
    return Array.from(this.outputImages.values())
  }

  selected(): SelectedArtifact | undefined {
    return this.selectedArtifact
  }

  select(provenance: ArtifactProvenance, path: string): BrowserImageSource | undefined {
    const selected = provenance === "input" ? this.images.get(path) : this.outputImages.get(path)
    if (selected !== undefined) this.selectedArtifact = { provenance, image: selected }
    return selected
  }
}
