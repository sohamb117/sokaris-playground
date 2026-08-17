import { expect, test } from "@playwright/test"

type HarnessResult =
  | { readonly kind: "scalar"; readonly value: number; readonly output: string }
  | {
      readonly kind: "image"
      readonly width: number
      readonly height: number
      readonly data: number[]
    }
  | { readonly kind: "error"; readonly message: string; readonly output: string }

const runHarness = async (
  page: import("@playwright/test").Page,
  source: string,
  images: readonly {
    readonly filename: string
    readonly width: number
    readonly height: number
    readonly data: readonly number[]
  }[] = [],
): Promise<HarnessResult> =>
  page.evaluate(
    async ({ source: evaluatedSource, images: evaluatedImages }) => {
      const harness = window.__sokarisRuntime
      if (harness === undefined) throw new Error("runtime harness is unavailable")
      return harness.run(evaluatedSource, evaluatedImages)
    },
    { source, images },
  )

test("starts without browser console errors, warnings, or failed requests", async ({ page }) => {
  // Given
  const consoleProblems: string[] = []
  const failedRequests: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`)
  })

  // When
  await page.goto("/")
  await expect(page.getByText("loading runtime")).toBeHidden({ timeout: 30_000 })

  // Then
  expect(consoleProblems).toEqual([])
  expect(failedRequests).toEqual([])
})

test("canonical glyph expression returns 42 in the local VM", async ({ page }) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  await expect(runHarness(page, "result = 21 ▷ (x -> x * 2)")).resolves.toMatchObject({
    kind: "scalar",
    value: 42,
  })
})

test("BrowserImage invert returns exact 2x2 row-major RGBA", async ({ page }) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  const data = [0, 0.25, 0.5, 1, 1, 0.75, 0.5, 0.5, 0.25, 0.5, 0.75, 0.25, 0.75, 0.5, 0.25, 0]
  await expect(
    runHarness(page, 'result = load("tiny.png") ▷ invert', [
      { filename: "tiny.png", width: 2, height: 2, data },
    ]),
  ).resolves.toEqual({
    kind: "image",
    width: 2,
    height: 2,
    data: [1, 0.75, 0.5, 1, 0, 0.25, 0.5, 0.5, 0.75, 0.5, 0.25, 0.25, 0.25, 0.5, 0.75, 0],
  })
})

test("missing load and unsupported transforms return explicit VM errors", async ({ page }) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  await expect(runHarness(page, 'result = load("missing.png")')).resolves.toMatchObject({
    kind: "error",
    message: "Sokaris subset error: image 'missing.png' is not loaded.",
  })
  await expect(
    runHarness(page, "result = gaussian(2)(BrowserImage(1, 1, Float64[0, 0, 0, 1]))"),
  ).resolves.toMatchObject({
    kind: "error",
    message: "Sokaris subset error: gaussian is not supported by SubsetJuliaVM v0.12.2.",
  })
})

test("runtime execution makes no backend or external evaluator request", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => requests.push(request.url()))
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  await runHarness(page, "result = 6 * 7")
  expect(requests.every((url) => new URL(url).origin === "http://127.0.0.1:4173")).toBe(true)
  expect(requests.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(false)
})

test("all fourteen glyphs are browser-probed or explicitly unsupported", async ({ page }) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  const scalarCases = [
    ["▷", "result = 21 ▷ (x -> x * 2)", 42],
    ["🝡", "result = 🝡(21, x -> x * 2)", 42],
    ["☽", "result = ☽(x -> x + 1, x -> x * 2)(20)", 41],
    ["∅", "result = sum(∅([1, 2, 3], x -> x * 2))", 12],
    ["✧", "result = ✧([1, 2, 3], (a, b) -> a + b)", 6],
    ["⚕", "result = ⚕(nothing, 42)", 42],
    ["☿", "result = ☿(x -> x * 2)(21)", 42],
    ["✦", "result = length(✦([1, 2], [3, 4]))", 4],
    ["☥", "result = ☥(42)", 42],
    ["⚸", "result = sum(⚸([1, 2, 3], (a, b) -> a + b))", 10],
  ] as const
  for (const [glyph, source, value] of scalarCases) {
    await expect(runHarness(page, source), glyph).resolves.toMatchObject({ kind: "scalar", value })
  }
  await expect(
    runHarness(
      page,
      "result = ⊙(BrowserImage(1, 1, Float64[0.5, 0.5, 0.5, 1]), BrowserImage(1, 1, Float64[0.5, 1, 0, 0.5]))",
    ),
  ).resolves.toMatchObject({ kind: "image", data: [0.25, 0.5, 0, 0.5] })
  await expect(
    runHarness(page, "result = ⇉(x -> x + 1, x -> x * 2)(20)[1]"),
  ).resolves.toMatchObject({ kind: "scalar", value: 21 })
  await expect(runHarness(page, "result = ⚹([1 2; 3 4], 1, 1)")).resolves.toMatchObject({
    kind: "error",
    message: "Sokaris subset error: ⚹ is not supported by SubsetJuliaVM v0.12.2.",
  })
  await expect(
    runHarness(page, "result = 𓇬(BrowserImage(1, 1, Float64[-1, 0.5, 2, 0.25]))"),
  ).resolves.toMatchObject({ kind: "image", data: [0, 0.5, 1, 0.25] })
})
