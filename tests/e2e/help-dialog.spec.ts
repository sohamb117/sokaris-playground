import { expect, test } from "@playwright/test"

const SUPPORTED_TRANSFORMS = [
  "invert",
  "gamma",
  "brightness",
  "contrast",
  "grayscale",
  "posterize",
  "threshold",
  "solarize",
  "pixelate",
] as const

const UNSUPPORTED_IMAGE_OPERATIONS = [
  "gaussian",
  "box_blur",
  "median_blur",
  "motion_blur",
  "saturate",
  "desaturate",
  "sharpen",
  "edge_detect",
  "emboss",
  "noise",
  "crop",
  "crop_center",
  "crop_to",
  "scale_crop",
  "glow",
  "text_overlay",
] as const

test("keeps the code editor unobscured when help opens at 1440x900", async ({ page }) => {
  // Given
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })

  // When
  await page.getByRole("button", { name: "Open Sokaris help" }).click()
  const dialog = page.getByRole("dialog", { name: "Sokaris compositor help" })

  // Then
  const editorBox = await editor.boundingBox()
  const dialogBox = await dialog.boundingBox()
  expect(editorBox).not.toBeNull()
  expect(dialogBox).not.toBeNull()
  if (editorBox !== null && dialogBox !== null) {
    expect(dialogBox.x).toBeGreaterThanOrEqual(720)
    expect(dialogBox.x).toBeGreaterThanOrEqual(editorBox.x + editorBox.width)
  }
})

test("keeps help within the output half and viewport at 1024x800", async ({ page }) => {
  // Given
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto("/")

  // When
  await page.getByRole("button", { name: "Open Sokaris help" }).click()
  const dialog = page.getByRole("dialog", { name: "Sokaris compositor help" })

  // Then
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  if (dialogBox !== null) {
    expect(dialogBox.x).toBeGreaterThanOrEqual(512)
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(1024)
    expect(dialogBox.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(800)
  }
})

for (const width of [900, 800]) {
  test(`anchors help to the output pane while the ${width}px viewport scrolls horizontally`, async ({
    page,
  }) => {
    // Given
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/")

    // When
    await page.getByRole("button", { name: "Open Sokaris help" }).click()
    const dialog = page.getByRole("dialog", { name: "Sokaris compositor help" })

    // Then
    await expect(dialog).toBeVisible()
    const geometry = await page.evaluate(() => {
      const editor = document.querySelector("[data-editor-column]")
      const output = document.querySelector("[data-output-pane]")
      const help = document.querySelector('[role="dialog"]')
      if (editor === null || output === null || help === null) return null
      const editorBox = editor.getBoundingClientRect()
      const outputBox = output.getBoundingClientRect()
      const helpBox = help.getBoundingClientRect()
      return {
        editorRight: editorBox.right + window.scrollX,
        helpLeft: helpBox.left + window.scrollX,
        helpRight: helpBox.right + window.scrollX,
        outputLeft: outputBox.left + window.scrollX,
        outputRight: outputBox.right + window.scrollX,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        parentIsOutput: help.parentElement === output,
      }
    })
    expect(geometry).not.toBeNull()
    expect(geometry?.parentIsOutput).toBe(true)
    expect(geometry?.scrollWidth).toBe(1024)
    expect(geometry?.scrollWidth).toBeGreaterThan(geometry?.viewportWidth ?? 0)
    expect(geometry?.helpLeft ?? 0).toBeGreaterThanOrEqual(geometry?.editorRight ?? 0)
    expect(geometry?.helpLeft ?? 0).toBeGreaterThanOrEqual(geometry?.outputLeft ?? 0)
    expect(geometry?.helpRight ?? 0).toBeLessThanOrEqual(geometry?.outputRight ?? 0)
  })
}

test("separates exact supported transforms from unsupported image operations", async ({ page }) => {
  // Given
  await page.goto("/")

  // When
  await page.getByRole("button", { name: "Open Sokaris help" }).click()
  const dialog = page.getByRole("dialog", { name: "Sokaris compositor help" })

  // Then
  const supported = dialog.getByRole("heading", { name: "Supported transforms" })
  const unsupported = dialog.getByRole("heading", { name: "Not supported in v0.12.2" })
  await expect(supported).toBeVisible()
  await expect(unsupported).toBeVisible()
  await expect(supported.locator("xpath=following-sibling::p[1]")).toHaveText(
    SUPPORTED_TRANSFORMS.join(", "),
  )
  await expect(unsupported.locator("xpath=following-sibling::p[1]")).toHaveText(
    UNSUPPORTED_IMAGE_OPERATIONS.join(", "),
  )
  await expect(unsupported.locator("xpath=following-sibling::p[1]")).not.toContainText("save")
})
