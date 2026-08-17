export type CaretPosition = {
  readonly left: number
  readonly top: number
  readonly lineHeight: number
}

export const measureCaret = (textarea: HTMLTextAreaElement): CaretPosition => {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement("div")
  const properties = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "boxSizing",
    "whiteSpace",
    "overflowWrap",
  ] as const
  mirror.className = "caret-mirror"
  mirror.style.width = `${textarea.clientWidth}px`
  for (const property of properties) mirror.style[property] = style[property]
  mirror.textContent = textarea.value.slice(0, textarea.selectionStart)
  const marker = document.createElement("span")
  marker.textContent =
    textarea.value.slice(textarea.selectionStart, textarea.selectionStart + 1) || " "
  mirror.append(marker)
  document.body.append(mirror)
  const textareaRect = textarea.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  const lineHeight = Number.parseFloat(style.lineHeight) || 21
  const position = {
    left: textareaRect.left + markerRect.left - mirrorRect.left - textarea.scrollLeft,
    top: textareaRect.top + markerRect.top - mirrorRect.top - textarea.scrollTop,
    lineHeight,
  }
  mirror.remove()
  return position
}
