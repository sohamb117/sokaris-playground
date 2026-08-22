import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import manifest from "../src/vendor/subset-julia/manifest.json"
import compilerManifest from "../src/vendor/subset-julia-compiler/manifest.json"

const artifactDigests = (directory: string, files: readonly { readonly path: string }[]) =>
  files.map((file) => {
    const path = resolve(directory, file.path)
    return {
      path: file.path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
      size: statSync(path).size,
    }
  })

describe("SubsetJuliaVM vendor manifest", () => {
  it("pins every local artifact to the approved commit and digest", () => {
    // Given
    const vendorDirectory = resolve(import.meta.dirname, "..", "src/vendor/subset-julia")

    // When
    const actual = artifactDigests(vendorDirectory, manifest.files)

    // Then
    expect(manifest.version).toBe("0.12.2")
    expect(manifest.commit).toBe("561587e7a6f3914a24afd883a0dba52d51f3453d")
    expect(actual.map(({ path, sha256 }) => ({ path, sha256 }))).toEqual(
      manifest.files.map(({ path, sha256 }) => ({ path, sha256 })),
    )
    expect(actual.find((file) => file.path.endsWith(".wasm"))?.size).toBe(26_217_180)
  })

  it("pins compiler artifacts, source identity, and both ABI layers", () => {
    // Given
    const vendorDirectory = resolve(import.meta.dirname, "..", "src/vendor/subset-julia-compiler")

    // When
    const actual = artifactDigests(vendorDirectory, compilerManifest.files)

    // Then
    expect(compilerManifest).toMatchObject({
      sourceProject: "subset_julia_vm",
      package: "subset_julia_vm_web",
      version: "0.11.1",
      compilerAbiVersion: 3,
      generatedMemoryAbiVersion: 2,
    })
    expect(actual.map(({ path, sha256 }) => ({ path, sha256 }))).toEqual(
      compilerManifest.files.map(({ path, sha256 }) => ({ path, sha256 })),
    )
    expect(actual.find((file) => file.path.endsWith(".wasm"))?.size).toBe(26_810_214)
  })
})
