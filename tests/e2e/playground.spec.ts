import { expect, type Page, test } from "@playwright/test"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

const waitForReady = async (page: Page): Promise<void> => {
  await expect(page.getByText("loading runtime")).toBeHidden({ timeout: 30_000 })
}

const upload = async (page: Page, name = "pixel.png", buffer = PNG): Promise<void> => {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer,
  })
}

async function createVisiblePng(page: Page, width = 32, height = 32): Promise<Buffer<ArrayBuffer>> {
  const base64 = await page.evaluate(
    ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement("canvas")
      canvas.width = imageWidth
      canvas.height = imageHeight
      const context = canvas.getContext("2d")
      if (context === null) return ""
      const middleX = Math.round(imageWidth / 2)
      const middleY = Math.round(imageHeight / 2)
      context.fillStyle = "#f00"
      context.fillRect(0, 0, middleX, middleY)
      context.fillStyle = "#0f0"
      context.fillRect(middleX, 0, imageWidth - middleX, middleY)
      context.fillStyle = "#00f"
      context.fillRect(0, middleY, middleX, imageHeight - middleY)
      context.fillStyle = "#fff"
      context.fillRect(middleX, middleY, imageWidth - middleX, imageHeight - middleY)
      return canvas.toDataURL("image/png").split(",")[1] ?? ""
    },
    { imageWidth: width, imageHeight: height },
  )
  return Buffer.from(base64, "base64")
}

const drop = async (
  page: Page,
  name: string,
  buffer: Buffer,
  mimeType = "image/png",
): Promise<void> => {
  const dataTransfer = await page.evaluateHandle(
    ({ base64, evaluatedName, evaluatedType }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], evaluatedName, { type: evaluatedType }))
      return transfer
    },
    { base64: buffer.toString("base64"), evaluatedName: name, evaluatedType: mimeType },
  )
  await page.locator(".image-drop-zone").dispatchEvent("drop", { dataTransfer })
  await dataTransfer.dispose()
}

test("renders only the accessible two-column playground controls", async ({ page }) => {
  // Given / When
  await page.goto("/")

  // Then
  await expect(page.getByRole("main")).toBeVisible()
  await expect(page.getByRole("button", { name: "Images", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  )
  await expect(page.getByRole("textbox", { name: "Sokaris code" })).toHaveValue(
    /function main!\(pixels::Vector\{UInt8\}\)/,
  )
  await expect(page.getByRole("button", { name: "Open Sokaris help" })).toHaveText("?")
  await expect(page.getByText("press shift for compositor menu", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /run/i })).toHaveCount(0)
})

test("uses exact 50/50 geometry and preserves the code pane while collapsing files", async ({
  page,
}) => {
  // Given
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const main = page.getByRole("main")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  await editor.focus()
  await editor.press("End")

  // When
  await main.screenshot({ path: "test-results/evidence/expanded.png" })
  const columns = await page
    .locator("[data-editor-column], [data-output-pane]")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
  await page.getByRole("button", { name: "Images", exact: true }).click()

  // Then
  expect(columns).toEqual([720, 720])
  await expect(page.getByRole("button", { name: "Images", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
  await expect(editor).toBeVisible()
  await expect(editor).toHaveValue(/function main!\(pixels::Vector\{UInt8\}\)/)
  await expect(page.getByRole("button", { name: "Select images" })).toHaveCount(0)
  await main.screenshot({ path: "test-results/evidence/collapsed.png" })
})

test("accepts images, replaces duplicate data in place, and rejects invalid decode", async ({
  page,
}) => {
  // Given
  await page.goto("/")
  await waitForReady(page)

  // When
  await drop(page, "pixel.png", PNG)
  await upload(page, "second.png")
  await upload(page, "pixel.png")

  // Then
  await expect(page.getByRole("button", { name: "Input inputs/input.png" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Input pixel.png" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Input second.png" })).toBeVisible()
  await drop(page, "broken.png", Buffer.from("not an image"))
  await expect(page.getByRole("alert")).toContainText("broken.png")
  await expect(page.getByRole("button", { name: /^Input / })).toHaveCount(3)
})

test("runs the active dropped image repeatedly and retains the last canvas on diagnostics", async ({
  page,
}) => {
  // Given
  await page.goto("/")
  await waitForReady(page)
  await upload(page, "pixel.png", await createVisiblePng(page))
  const editor = page.getByRole("textbox", { name: "Sokaris code" })

  // When
  const canvas = page.locator("canvas")
  await expect(canvas).toHaveAttribute("width", "32", { timeout: 30_000 })
  await editor.focus()
  await editor.press("End")
  await page.keyboard.insertText("\n")
  await expect(canvas).toHaveAttribute("width", "32")
  await page.getByRole("main").screenshot({ path: "test-results/evidence/image-success.png" })
  await editor.fill(`function main!(pixels::Vector{UInt8})
    label = String(pixels)
end`)

  // Then
  await expect(page.getByRole("alert")).toContainText("target_ty: Str", { timeout: 30_000 })
  await expect(canvas).toBeVisible()
  const outputBox = await page.locator("[data-output-pane]").boundingBox()
  const alertBox = await page.getByRole("alert").boundingBox()
  expect(outputBox).not.toBeNull()
  expect(alertBox).not.toBeNull()
  if (outputBox !== null && alertBox !== null) {
    expect(alertBox.x).toBe(outputBox.x + 12)
    expect(alertBox.width).toBe(outputBox.width - 24)
    expect(alertBox.y + alertBox.height).toBe(outputBox.y + outputBox.height - 12)
  }
  await editor.fill("result = (")
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator("canvas")).toBeVisible()
  await page.getByRole("main").screenshot({ path: "test-results/evidence/error-retained.png" })
})

test("compiles a native 800x768 active image in under three seconds when warm", async ({
  page,
}) => {
  // Given
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await waitForReady(page)
  const canvas = page.locator("canvas")
  const started = performance.now()

  // When
  await upload(page, "output.png", await createVisiblePng(page, 800, 768))
  await expect(canvas).toHaveAttribute("width", "800", { timeout: 3_000 })
  const elapsed = performance.now() - started

  // Then
  await expect(page.getByRole("button", { name: "Input inputs/input.png" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Input output.png" })).toBeVisible()
  expect(elapsed).toBeLessThan(3_000)
  await expect(canvas).toHaveAttribute("height", "768")
  const canvasBox = await canvas.boundingBox()
  expect((canvasBox?.width ?? 0) / (canvasBox?.height ?? 1)).toBeCloseTo(800 / 768, 2)
  await expect(page.locator('[role="alert"]')).toBeHidden()
  await expect(page.locator("body")).not.toContainText("unreachable")
})

test("debounces edits for 300ms and ignores stale output", async ({ page }) => {
  // Given
  await page.goto("/")
  await waitForReady(page)
  const editor = page.getByRole("textbox", { name: "Sokaris code" })

  // When
  await editor.fill("result = 1")
  await page.waitForTimeout(150)
  await editor.fill("result = 2")
  await page.waitForTimeout(150)

  // Then
  await expect(page.locator("[data-scalar-result]")).not.toHaveText("1")
  await expect(page.locator("[data-scalar-result]")).toHaveText("2", { timeout: 30_000 })
})

test("opens the exact caret menu and supports insertion, keyboard, and outside dismissal", async ({
  page,
}) => {
  // Given
  await page.goto("/")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  await editor.focus()
  await editor.press("Home")

  // When
  await page.keyboard.down("Shift")
  await page.keyboard.press("A")
  await page.keyboard.up("Shift")

  // Then
  await expect(page.getByRole("menu")).toBeHidden()
  await editor.fill("result = 21 ▷ (x -> x * 2)")
  await editor.press("Home")

  // When
  await page.keyboard.press("Shift")
  const menu = page.getByRole("menu")

  // Then
  await expect(menu).toBeVisible()
  await expect(menu.getByRole("menuitem")).toHaveText([
    /▷/,
    /🝡/,
    /☽/,
    /⊙/,
    /∅/,
    /✧/,
    /⇉/,
    /⚕/,
    /𓇬/,
    /☿/,
    /⚹/,
    /✦/,
    /☥/,
    /⚸/,
  ])
  await page.getByRole("main").screenshot({ path: "test-results/evidence/menu-at-caret.png" })
  await page.keyboard.press("Home")
  await page.keyboard.press("Enter")
  await expect(editor).toHaveValue(`▷result = 21 ▷ (x -> x * 2)`)
  await page.keyboard.press("Shift")
  await page.mouse.click(1000, 100)
  await expect(menu).toBeHidden()
  await editor.focus()
  await page.keyboard.press("Shift")
  await menu.getByRole("menuitem").nth(1).click()
  await expect(editor).toHaveValue(`▷🝡result = 21 ▷ (x -> x * 2)`)
})

test("uses only the approved UI palette and forbidden CSS never computes", async ({ page }) => {
  // Given / When
  await page.goto("/")
  const violations = await page.locator("body *").evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const style = getComputedStyle(node)
      const colors = [style.color, style.backgroundColor, style.borderColor]
      const invalidColor = colors.some(
        (color) =>
          color !== "rgb(0, 0, 0)" &&
          color !== "rgb(255, 255, 255)" &&
          color !== "rgba(0, 0, 0, 0)",
      )
      return invalidColor || style.borderRadius !== "0px" || style.boxShadow !== "none"
        ? [node.tagName]
        : []
    }),
  )

  // Then
  expect(violations).toEqual([])
})
