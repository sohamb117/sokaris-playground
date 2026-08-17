import { measureCaret } from "./caret-position.ts"
import { GLYPHS } from "./glyphs.ts"

type MenuOptions = {
  readonly textarea: HTMLTextAreaElement
  readonly onInsert: () => void
}

export class OperatorMenu {
  private menu: HTMLElement | undefined
  private shiftPending = false

  constructor(private readonly options: MenuOptions) {
    options.textarea.addEventListener("keydown", this.onTextareaKeydown)
    options.textarea.addEventListener("keyup", this.onTextareaKeyup)
  }

  private readonly onTextareaKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Shift" && !event.repeat) {
      this.shiftPending = true
      return
    }
    if (event.shiftKey) this.shiftPending = false
  }

  private readonly onTextareaKeyup = (event: KeyboardEvent): void => {
    if (event.key !== "Shift" || !this.shiftPending) return
    event.preventDefault()
    this.shiftPending = false
    this.open()
  }

  private open(): void {
    this.close(false)
    const position = measureCaret(this.options.textarea)
    const menu = document.createElement("div")
    menu.className = "operator-menu"
    menu.setAttribute("role", "menu")
    for (const entry of GLYPHS) {
      const button = document.createElement("button")
      button.type = "button"
      button.setAttribute("role", "menuitem")
      button.textContent = `${entry.glyph} ${entry.description}`
      button.addEventListener("click", () => this.insert(entry.glyph))
      menu.append(button)
    }
    document.body.append(menu)
    const rect = menu.getBoundingClientRect()
    const left = Math.max(4, Math.min(position.left, window.innerWidth - rect.width - 4))
    const below = position.top + position.lineHeight
    const top = below + rect.height <= window.innerHeight - 4 ? below : position.top - rect.height
    menu.style.left = `${left}px`
    menu.style.top = `${Math.max(4, top)}px`
    this.menu = menu
    document.addEventListener("pointerdown", this.onOutsidePointer)
    menu.addEventListener("keydown", this.onMenuKeydown)
    const first = menu.querySelector("button")
    if (first instanceof HTMLButtonElement) first.focus()
  }

  private insert(glyph: string): void {
    const textarea = this.options.textarea
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.setRangeText(glyph, start, end, "end")
    this.close(false)
    textarea.focus()
    this.options.onInsert()
  }

  private readonly onOutsidePointer = (event: PointerEvent): void => {
    if (event.target instanceof Node && this.menu?.contains(event.target)) return
    this.close(false)
  }

  private readonly onMenuKeydown = (event: KeyboardEvent): void => {
    const buttons = this.menu?.querySelectorAll("button")
    if (buttons === undefined || buttons.length === 0) return
    const active = document.activeElement
    const current = active instanceof HTMLButtonElement ? Array.from(buttons).indexOf(active) : -1
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault()
      this.close(true)
      return
    }
    if (event.key === "Enter" && active instanceof HTMLButtonElement) {
      event.preventDefault()
      active.click()
      return
    }
    let next = current
    if (event.key === "ArrowDown") next = (current + 1) % buttons.length
    else if (event.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = buttons.length - 1
    else return
    event.preventDefault()
    buttons[next]?.focus()
  }

  close(restoreFocus: boolean): void {
    if (this.menu === undefined) return
    document.removeEventListener("pointerdown", this.onOutsidePointer)
    this.menu.removeEventListener("keydown", this.onMenuKeydown)
    this.menu.remove()
    this.menu = undefined
    if (restoreFocus) this.options.textarea.focus()
  }

  dispose(): void {
    this.close(false)
    this.options.textarea.removeEventListener("keydown", this.onTextareaKeydown)
    this.options.textarea.removeEventListener("keyup", this.onTextareaKeyup)
  }
}
