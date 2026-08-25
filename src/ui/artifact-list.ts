import type { BrowserImageSource } from "../runtime/types.ts"

export type ArtifactProvenance = "input" | "output"

type ArtifactListOptions = {
  readonly provenance: ArtifactProvenance
  readonly images: readonly BrowserImageSource[]
  readonly selectedPath: string | undefined
  readonly onSelect: (path: string) => void
}

const accessibleProvenance = {
  input: "Input",
  output: "Output",
} as const satisfies Record<ArtifactProvenance, string>

export const renderArtifactList = (list: HTMLUListElement, options: ArtifactListOptions): void => {
  const rows = options.images.map((image) => {
    const item = document.createElement("li")
    const button = document.createElement("button")
    button.type = "button"
    button.className = "artifact-button"
    button.textContent = image.filename.split("/").at(-1) ?? image.filename
    button.setAttribute(
      "aria-label",
      `${accessibleProvenance[options.provenance]} ${image.filename}`,
    )
    button.setAttribute("aria-pressed", String(image.filename === options.selectedPath))
    button.addEventListener("click", () => options.onSelect(image.filename))
    item.append(button)
    return item
  })
  list.replaceChildren(...rows)
}
