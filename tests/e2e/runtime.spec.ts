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
  | {
      readonly kind: "artifacts"
      readonly artifacts: readonly {
        readonly filename: string
        readonly width: number
        readonly height: number
        readonly data: readonly number[]
      }[]
    }

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

test("compiled helper loop and branch return exact native RGBA bytes", async ({ page }) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  const data = [0, 64, 128, 255, 1, 2, 3, 254]
  const source = `function invert(value::UInt8)::UInt8
    return UInt8(255 - value)
end
function main!(pixels::Vector{UInt8})
    index = 1
    while index <= length(pixels)
        if index != 4 && index != 8
            pixels[index] = invert(pixels[index])
        end
        index = index + 1
    end
end`
  await expect(
    runHarness(page, source, [{ filename: "tiny.png", width: 2, height: 1, data }]),
  ).resolves.toEqual({
    kind: "image",
    width: 2,
    height: 1,
    data: [255, 191, 127, 255, 254, 253, 252, 254],
  })
})

test("load without main! shows migration guidance and compiler diagnostics remain explicit", async ({
  page,
}) => {
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  await expect(runHarness(page, 'result = load("missing.png")')).resolves.toMatchObject({
    kind: "error",
    message: expect.stringContaining("main!(pixels::Vector{UInt8})"),
  })
  await expect(
    runHarness(
      page,
      `function main!(pixels::Vector{UInt8})
    label = String(pixels)
end`,
      [{ filename: "tiny.png", width: 1, height: 1, data: [0, 0, 0, 255] }],
    ),
  ).resolves.toMatchObject({
    kind: "error",
    message: expect.stringContaining("target_ty: Str"),
  })
})

test("runtime execution makes no backend or external evaluator request", async ({ page }) => {
  // Given
  const requests: string[] = []
  page.on("request", (request) => requests.push(request.url()))

  // When
  await page.goto("/?runtime-test=1")
  await expect.poll(() => page.evaluate(() => window.__sokarisRuntime?.ready)).toBe(true)
  await runHarness(page, "result = 6 * 7")

  // Then
  expect(requests.every((url) => new URL(url).origin === "http://127.0.0.1:4173")).toBe(true)
  expect(requests.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(false)
  expect(requests.some((url) => new URL(url).hostname !== "127.0.0.1")).toBe(false)
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
    runHarness(page, "result = ⇉(x -> x + 1, x -> x * 2)(20)[1]"),
  ).resolves.toMatchObject({ kind: "scalar", value: 21 })
  await expect(runHarness(page, "result = ⚹([1 2; 3 4], 1, 1)")).resolves.toMatchObject({
    kind: "error",
    message: "Sokaris subset error: ⚹ is not supported by SubsetJuliaVM v0.12.2.",
  })
})
