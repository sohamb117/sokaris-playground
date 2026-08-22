import { loadStarterImage } from "../examples/load-starter-image.ts"
import { paintImage } from "./canvas-painter.ts"
import { Debouncer } from "./debouncer.ts"
import { createPlaygroundDom, type PlaygroundDom } from "./dom.ts"
import { HelpDialog } from "./help-dialog.ts"
import { decodeImages, ImageDecodeError } from "./image-decoder.ts"
import { ImageRegistry } from "./image-registry.ts"
import { OperatorMenu } from "./operator-menu.ts"
import { createRuntimeClient } from "./runtime-client.ts"

export type SokarisApp = { readonly dispose: () => void }

const renderFiles = (dom: PlaygroundDom, registry: ImageRegistry): void => {
  dom.fileList.replaceChildren()
  for (const image of registry.list()) {
    const item = document.createElement("li")
    item.textContent = image.filename
    dom.fileList.append(item)
  }
}

export const mountSokarisApp = (root: HTMLElement): SokarisApp => {
  const dom = createPlaygroundDom()
  root.replaceChildren(dom.main)
  const runtime = createRuntimeClient()
  const registry = new ImageRegistry()
  const starterImage = loadStarterImage()
  const debouncer = new Debouncer(300)
  let ready = false
  let disposed = false
  let latestRun = 0

  const showError = (message: string): void => {
    dom.alert.textContent = message
    dom.alert.hidden = false
    dom.scalar.hidden = true
  }

  const showBusy = (): void => {
    dom.outputPane.setAttribute("aria-busy", "true")
    dom.loading.textContent = "running"
    dom.loading.hidden = false
    dom.scalar.hidden = true
  }

  const finishBusy = (): void => {
    dom.outputPane.removeAttribute("aria-busy")
    dom.loading.hidden = true
  }

  const execute = async (): Promise<void> => {
    if (!ready || disposed) return
    const run = latestRun + 1
    latestRun = run
    showBusy()
    const activeImage = registry.active()
    const result = await runtime.run({
      source: dom.textarea.value,
      images: activeImage === undefined ? [] : [activeImage],
    })
    if (disposed || run !== latestRun || result.kind === "stale") return
    finishBusy()
    if (result.kind === "error") {
      showError(result.message)
      return
    }
    dom.alert.hidden = true
    if (result.kind === "image") {
      try {
        paintImage(dom.canvas, result)
      } catch (error) {
        if (error instanceof Error) showError(error.message)
        else throw error
        return
      }
      dom.canvas.hidden = false
      dom.scalar.hidden = true
      return
    }
    dom.scalar.textContent = String(result.value)
    dom.scalar.hidden = false
  }

  const schedule = (): void => debouncer.schedule(() => void execute())
  const acceptFiles = async (files: FileList | readonly File[]): Promise<void> => {
    try {
      const decoded = await decodeImages(files)
      registry.replace(decoded)
      renderFiles(dom, registry)
      schedule()
    } catch (error) {
      if (error instanceof ImageDecodeError) showError(error.message)
      else throw error
    }
  }

  const onInput = (): void => schedule()
  const onFileChange = (): void => {
    if (dom.fileInput.files !== null) void acceptFiles(dom.fileInput.files)
    dom.fileInput.value = ""
  }
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    dom.dropZone.classList.remove("is-dragging")
    if (event.dataTransfer !== null) void acceptFiles(event.dataTransfer.files)
  }
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault()
    dom.dropZone.classList.add("is-dragging")
  }
  const onDragLeave = (): void => dom.dropZone.classList.remove("is-dragging")
  const onToggleImages = (): void => {
    const expanded = dom.imageToggle.getAttribute("aria-expanded") === "true"
    dom.imageToggle.setAttribute("aria-expanded", String(!expanded))
    dom.editorColumn.classList.toggle("files-collapsed", expanded)
    dom.fileInput.hidden = expanded
  }
  const preserveTextareaFocus = (event: PointerEvent): void => event.preventDefault()

  dom.textarea.addEventListener("input", onInput)
  dom.fileInput.addEventListener("change", onFileChange)
  dom.dropZone.addEventListener("drop", onDrop)
  dom.dropZone.addEventListener("dragover", onDragOver)
  dom.dropZone.addEventListener("dragleave", onDragLeave)
  dom.imageToggle.addEventListener("click", onToggleImages)
  dom.imageToggle.addEventListener("pointerdown", preserveTextareaFocus)
  const menu = new OperatorMenu({ textarea: dom.textarea, onInsert: schedule })
  const help = new HelpDialog(dom.helpTrigger, dom.outputPane)

  void Promise.all([runtime.ready, starterImage]).then(
    ([, image]) => {
      if (disposed) return
      registry.replace([image])
      renderFiles(dom, registry)
      ready = true
      dom.loading.hidden = true
      void execute()
    },
    (error: unknown) => {
      if (disposed) return
      dom.loading.hidden = true
      dom.outputPane.removeAttribute("aria-busy")
      showError(error instanceof Error ? error.message : "Runtime initialization failed")
    },
  )

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      debouncer.dispose()
      menu.dispose()
      help.dispose()
      runtime.dispose()
      dom.textarea.removeEventListener("input", onInput)
      dom.fileInput.removeEventListener("change", onFileChange)
      dom.dropZone.removeEventListener("drop", onDrop)
      dom.dropZone.removeEventListener("dragover", onDragOver)
      dom.dropZone.removeEventListener("dragleave", onDragLeave)
      dom.imageToggle.removeEventListener("click", onToggleImages)
      dom.imageToggle.removeEventListener("pointerdown", preserveTextareaFocus)
    },
  }
}
