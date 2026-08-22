import { STARTER_SOURCE } from "../examples/starter.ts"
import { GLYPHS } from "./glyphs.ts"
import { COMPILER_REFERENCE, PROGRAM_RULES, RUNTIME_LIMITS } from "./help-content.ts"

const heading = (text: string): HTMLHeadingElement => {
  const node = document.createElement("h2")
  node.textContent = text
  return node
}

const paragraph = (text: string): HTMLParagraphElement => {
  const node = document.createElement("p")
  node.textContent = text
  return node
}

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

    const starter = document.createElement("pre")
    starter.textContent = STARTER_SOURCE
    const compilerDetails = COMPILER_REFERENCE.map((entry) =>
      paragraph(`${entry.signature} — ${entry.description}`),
    )
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
      heading("Quick start"),
      starter,
      heading("Program rules"),
      paragraph(PROGRAM_RULES.join(" ")),
      heading("Compiler subset"),
      ...compilerDetails,
      heading("Compositor glyphs"),
      glyphList,
      heading("Runtime limits"),
      paragraph(RUNTIME_LIMITS.join(" ")),
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
