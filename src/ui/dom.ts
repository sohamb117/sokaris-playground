const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
  const node = document.createElement(tag)
  node.className = className
  return node
}

export type PlaygroundDom = {
  readonly main: HTMLElement
  readonly editorColumn: HTMLElement
  readonly outputPane: HTMLElement
  readonly imageToggle: HTMLButtonElement
  readonly dropZone: HTMLLabelElement
  readonly fileInput: HTMLInputElement
  readonly fileList: HTMLUListElement
  readonly textarea: HTMLTextAreaElement
  readonly helpTrigger: HTMLButtonElement
  readonly loading: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly scalar: HTMLOutputElement
  readonly alert: HTMLElement
}

export const createPlaygroundDom = (): PlaygroundDom => {
  const main = element("main", "playground")
  main.setAttribute("aria-label", "Sokaris playground")

  const editorColumn = element("section", "editor-column")
  editorColumn.setAttribute("data-editor-column", "")
  const imagePane = element("section", "image-pane")
  const imageToggle = element("button", "image-toggle")
  imageToggle.type = "button"
  imageToggle.textContent = "Images"
  imageToggle.setAttribute("aria-expanded", "true")
  const dropZone = element("label", "image-drop-zone")
  dropZone.textContent = "drop images or select files"
  const fileInput = element("input", "file-input")
  fileInput.type = "file"
  fileInput.accept = "image/*"
  fileInput.multiple = true
  fileInput.setAttribute("aria-label", "Select images")
  const fileList = element("ul", "file-list")
  fileList.setAttribute("aria-label", "Loaded images")
  dropZone.append(fileInput, fileList)
  imagePane.append(imageToggle, dropZone)

  const codePane = element("section", "code-pane")
  const textarea = element("textarea", "code-editor")
  textarea.setAttribute("aria-label", "Sokaris code")
  textarea.spellcheck = false
  textarea.value = "result = 21 ▷ (x -> x * 2)"
  codePane.append(textarea)

  const footer = element("footer", "help-footer")
  const helpTrigger = element("button", "help-trigger")
  helpTrigger.type = "button"
  helpTrigger.textContent = "?"
  helpTrigger.setAttribute("aria-label", "Open Sokaris help")
  const instruction = document.createElement("span")
  instruction.textContent = "press shift for compositor menu"
  footer.append(helpTrigger, instruction)
  editorColumn.append(imagePane, codePane, footer)

  const outputPane = element("section", "output-pane")
  outputPane.setAttribute("data-output-pane", "")
  outputPane.setAttribute("aria-label", "Sokaris output")
  const loading = element("p", "loading")
  loading.textContent = "loading runtime"
  const canvas = element("canvas", "result-canvas")
  canvas.hidden = true
  const scalar = element("output", "scalar-result")
  scalar.setAttribute("data-scalar-result", "")
  scalar.hidden = true
  const alert = element("p", "error-alert")
  alert.setAttribute("role", "alert")
  alert.hidden = true
  outputPane.append(loading, canvas, scalar, alert)
  main.append(editorColumn, outputPane)

  return {
    main,
    editorColumn,
    outputPane,
    imageToggle,
    dropZone,
    fileInput,
    fileList,
    textarea,
    helpTrigger,
    loading,
    canvas,
    scalar,
    alert,
  }
}
