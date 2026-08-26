import type { BrowserImageSource } from "./types.ts"

export class VirtualPathError extends Error {
  readonly name = "VirtualPathError"

  constructor(readonly path: string) {
    super(`Invalid virtual image path: ${path}`)
  }
}

export class VirtualFileNotFoundError extends Error {
  readonly name = "VirtualFileNotFoundError"

  constructor(readonly path: string) {
    super(`Virtual image not found: ${path}`)
  }
}

export const normalizeVirtualPath = (path: string): string => {
  if (path.length === 0 || path.includes("\0") || /^[A-Za-z]:[\\/]/.test(path)) {
    throw new VirtualPathError(path)
  }
  const portable = path.replaceAll("\\", "/")
  if (portable.startsWith("/")) throw new VirtualPathError(path)
  const normalized: string[] = []
  for (const component of portable.split("/")) {
    if (component === "" || component === "..") throw new VirtualPathError(path)
    if (component !== ".") normalized.push(component)
  }
  if (normalized.length === 0) throw new VirtualPathError(path)
  return normalized.join("/")
}

const copyImage = (path: string, image: BrowserImageSource): BrowserImageSource => ({
  filename: path,
  width: image.width,
  height: image.height,
  data: new Uint8ClampedArray(image.data),
})

export class BrowserImageRun {
  private readonly staged = new Map<string, BrowserImageSource>()
  private settled = false

  constructor(
    private readonly publish: (outputs: ReadonlyMap<string, BrowserImageSource>) => void,
  ) {}

  save(path: string, image: BrowserImageSource): void {
    if (this.settled) throw new TypeError("Image run is already settled")
    const normalized = normalizeVirtualPath(path)
    this.staged.set(normalized, copyImage(normalized, image))
  }

  commit(): void {
    if (this.settled) throw new TypeError("Image run is already settled")
    this.settled = true
    this.publish(this.staged)
  }

  rollback(): void {
    if (this.settled) throw new TypeError("Image run is already settled")
    this.settled = true
  }
}

export class BrowserImageFileSystem {
  private readonly inputFiles = new Map<string, BrowserImageSource>()
  private outputFiles = new Map<string, BrowserImageSource>()

  replaceInputs(images: readonly BrowserImageSource[]): void {
    this.outputFiles = new Map()
    for (const image of images) {
      const path = normalizeVirtualPath(image.filename)
      this.inputFiles.set(path, copyImage(path, image))
    }
  }

  inputs(): readonly BrowserImageSource[] {
    return Array.from(this.inputFiles.values())
  }

  outputs(): readonly BrowserImageSource[] {
    return Array.from(this.outputFiles.values())
  }

  load(path: string): BrowserImageSource {
    const normalized = normalizeVirtualPath(path)
    const image = this.outputFiles.get(normalized) ?? this.inputFiles.get(normalized)
    if (image === undefined) throw new VirtualFileNotFoundError(normalized)
    return copyImage(normalized, image)
  }

  beginRun(): BrowserImageRun {
    return new BrowserImageRun((outputs) => {
      this.outputFiles = new Map(outputs)
    })
  }
}
