import { loadStarterImage } from "../examples/load-starter-image.ts"
import type { RuntimeImage } from "../runtime/types.ts"
import { type ArtifactProvenance, renderArtifactList } from "./artifact-list.ts"
import { paintImage } from "./canvas-painter.ts"
import { Debouncer } from "./debouncer.ts"
import { createPlaygroundDom } from "./dom.ts"
import { HelpDialog } from "./help-dialog.ts"
import { decodeImages, ImageDecodeError } from "./image-decoder.ts"
import { ImageRegistry } from "./image-registry.ts"
import { OperatorMenu } from "./operator-menu.ts"
import { createRuntimeClient } from "./runtime-client.ts"

export type SokarisApp = { readonly dispose: () => void }

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

  const preview = (image: RuntimeImage): boolean => {
    try {
      paintImage(dom.canvas, image)
    } catch (error) {
      if (error instanceof Error) showError(error.message)
      else throw error
      return false
    }
    dom.canvas.hidden = false
    dom.scalar.hidden = true
    return true
  }

  const selectArtifact = (provenance: ArtifactProvenance, path: string): void => {
    const images = provenance === "input" ? registry.list() : registry.outputs()
    const image = images.find(({ filename }) => filename === path)
    if (image === undefined || !preview(image)) return
    registry.select(provenance, path)
    renderFiles()
  }

  const renderFiles = (): void => {
    const selected = registry.selected()
    renderArtifactList(dom.fileList, {
      provenance: "input",
      images: registry.list(),
      selectedPath: selected?.provenance === "input" ? selected.image.filename : undefined,
      onSelect: (path) => selectArtifact("input", path),
    })
    renderArtifactList(dom.outputList, {
      provenance: "output",
      images: registry.outputs(),
      selectedPath: selected?.provenance === "output" ? selected.image.filename : undefined,
      onSelect: (path) => selectArtifact("output", path),
    })
  }

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
    const result = await runtime.run({
      source: dom.textarea.value,
      images: registry.list(),
    })
    if (disposed || run !== latestRun || result.kind === "stale") return
    finishBusy()
    if (result.kind === "error") {
      showError(result.message)
      return
    }
    dom.alert.hidden = true
    if (result.kind === "image") {
      preview(result)
      return
    }
    if (result.kind === "artifacts") {
      const artifact = result.artifacts.at(-1)
      if (artifact !== undefined && !preview(artifact)) return
      registry.replaceOutputs(result.artifacts)
      renderFiles()
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
      renderFiles()
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
      renderFiles()
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
