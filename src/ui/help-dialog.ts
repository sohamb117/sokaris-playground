import { SUPPORTED_TRANSFORMS } from "../runtime/transform-catalog.ts"
import { UNSUPPORTED_TRANSFORMS } from "../runtime/unsupported-source.ts"
import { GLYPHS } from "./glyphs.ts"

export class HelpDialog {
  private dialog: HTMLElement | undefined

  constructor(
    private readonly trigger: HTMLButtonElement,
    private readonly outputPane: HTMLElement,
  ) {
    trigger.addEventListener("click", this.toggle)
  }

  private readonly toggle = (): void => {
    if (this.dialog === undefined) this.open()
    else this.close(true)
  }

  private open(): void {
    const dialog = document.createElement("section")
    dialog.className = "help-dialog"
    dialog.setAttribute("role", "dialog")
    dialog.setAttribute("aria-label", "Sokaris compositor help")

    const intro = document.createElement("p")
    intro.textContent = "SubsetJuliaVM is a Julia subset, not full Julia."
    const workflow = document.createElement("p")
    workflow.textContent =
      'Drop images to register exact filenames for load("name"). Images become a maximum 32×32 VM working preview because SubsetJuliaVM cannot practically parse full-resolution numeric image literals. Assign the final value to result. Source edits and valid image changes auto-run after 300ms.'
    const transformHeading = document.createElement("h2")
    transformHeading.textContent = "Supported transforms"
    const transforms = document.createElement("p")
    transforms.textContent = SUPPORTED_TRANSFORMS.join(", ")
    const unsupportedHeading = document.createElement("h2")
    unsupportedHeading.textContent = "Not supported in v0.12.2"
    const unsupported = document.createElement("p")
    unsupported.textContent = UNSUPPORTED_TRANSFORMS.filter((name) => name !== "save").join(", ")
    const glyphHeading = document.createElement("h2")
    glyphHeading.textContent = "Compositor glyphs"
    const glyphList = document.createElement("dl")
    for (const entry of GLYPHS) {
      const row = document.createElement("div")
      row.setAttribute("data-glyph-help", "")
      const term = document.createElement("dt")
      term.textContent = entry.glyph
      const definition = document.createElement("dd")
      definition.textContent = entry.description
      row.append(term, " ", definition)
      glyphList.append(row)
    }
    dialog.append(
      intro,
      workflow,
      transformHeading,
      transforms,
      unsupportedHeading,
      unsupported,
      glyphHeading,
      glyphList,
    )
    this.outputPane.append(dialog)
    this.dialog = dialog
    document.addEventListener("keydown", this.onKeydown)
    document.addEventListener("pointerdown", this.onOutsidePointer)
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return
    event.preventDefault()
    this.close(true)
  }

  private readonly onOutsidePointer = (event: PointerEvent): void => {
    if (
      event.target instanceof Node &&
      (this.dialog?.contains(event.target) || event.target === this.trigger)
    ) {
      return
    }
    this.close(true)
  }

  private close(restoreFocus: boolean): void {
    if (this.dialog === undefined) return
    document.removeEventListener("keydown", this.onKeydown)
    document.removeEventListener("pointerdown", this.onOutsidePointer)
    this.dialog.remove()
    this.dialog = undefined
    if (restoreFocus) this.trigger.focus()
  }

  dispose(): void {
    this.close(false)
    this.trigger.removeEventListener("click", this.toggle)
  }
}
