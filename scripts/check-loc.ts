const MAX_PURE_LINES = 250

const SOURCE_GLOB = "**/*.{ts,tsx,mts,cts,js,jsx,json,jsonc,html,md,css}"

const EXCLUDED_PREFIXES = [
  ".git/",
  "coverage/",
  "dist/",
  "node_modules/",
  "playwright-report/",
  "src/vendor/subset-julia/",
  "src/vendor/subset-julia-compiler/",
  "test-results/",
] as const

export const countPureLines = (source: string): number =>
  source.split("\n").filter((line) => {
    const trimmed = line.trim()
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("--") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("*/")
    )
  }).length

if (import.meta.main) {
  const violations: string[] = []
  const glob = new Bun.Glob(SOURCE_GLOB)

  for await (const path of glob.scan({ cwd: ".", dot: true, onlyFiles: true })) {
    if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      continue
    }

    const pureLines = countPureLines(await Bun.file(path).text())
    if (pureLines > MAX_PURE_LINES) {
      violations.push(`${path}: ${pureLines} pure lines`)
    }
  }

  if (violations.length === 0) {
    console.log(
      `LOC check passed: every authored source file is at most ${MAX_PURE_LINES} pure lines.`,
    )
  } else {
    console.error(`LOC check failed:\n${violations.join("\n")}`)
    process.exitCode = 1
  }
}
