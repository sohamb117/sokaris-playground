import { describe, expect, it, vi } from "vitest"

import type { CompilerSuccess } from "../src/runtime/compiler-contract.ts"
import { executeCompiledScript, validateScriptImports } from "../src/runtime/script-executor.ts"
import { BrowserImageFileSystem } from "../src/runtime/virtual-filesystem.ts"

const emptyModule = (): Promise<WebAssembly.Module> =>
  WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

const metadata = (bytes: Uint8Array): CompilerSuccess => ({
  bytes,
  compilerVersion: "0.11.1",
  abiVersion: 2,
  entryPoint: "__sjulia_script_entry",
  imports: [
    {
      module: "sjulia_host",
      name: "load",
      functionName: "__sjulia_host_load",
      params: ["String", "Int64", "Int64"],
      result: "Int64",
    },
    {
      module: "sjulia_host",
      name: "save",
      functionName: "__sjulia_host_save",
      params: ["String", "Int64"],
      result: "Int64",
    },
  ],
})

describe("script import validation", () => {
  it("accepts exact declared module and function names", () => {
    const compiled = metadata(new Uint8Array())

    expect(() =>
      validateScriptImports(compiled.imports, [
        { module: "sjulia_host", name: "load", kind: "function" },
        { module: "sjulia_host", name: "save", kind: "function" },
      ]),
    ).not.toThrow()
  })

  it("rejects undeclared or missing imports", () => {
    const compiled = metadata(new Uint8Array())

    expect(() =>
      validateScriptImports(compiled.imports, [
        { module: "sjulia_host", name: "load", kind: "function" },
        { module: "env", name: "save", kind: "function" },
      ]),
    ).toThrow("Compiled module imports do not match compiler metadata")
  })
})

describe("compiled script execution", () => {
  it("commits staged artifacts only after the entry returns", async () => {
    const module = await emptyModule()
    const filesystem = new BrowserImageFileSystem()
    const memory = new WebAssembly.Memory({ initial: 1 })
    const entry = vi.fn(() => undefined)
    const allocate = vi.fn(() => 128)
    const importsSeen: WebAssembly.Imports[] = []

    const outputs = await executeCompiledScript(module, metadata(new Uint8Array()), filesystem, {
      moduleImports: () => [
        { module: "sjulia_host", name: "load", kind: "function" },
        { module: "sjulia_host", name: "save", kind: "function" },
      ],
      instantiate: (_module, imports) => {
        importsSeen.push(imports)
        return {
          exports: {
            memory,
            __sjulia_alloc: allocate,
            __sjulia_script_entry: entry,
            __sjulia_wasm_abi_version: () => 2,
          },
        }
      },
    })

    expect(entry).toHaveBeenCalledOnce()
    expect(importsSeen[0]).toHaveProperty("sjulia_host.load")
    expect(outputs).toEqual([])
    expect(filesystem.outputs()).toEqual([])
  })

  it("rolls back staged artifacts when the entry traps", async () => {
    const module = await emptyModule()
    const filesystem = new BrowserImageFileSystem()
    const memory = new WebAssembly.Memory({ initial: 1 })
    const prior = filesystem.beginRun()
    prior.save("prior.png", {
      filename: "prior.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([1, 2, 3, 4]),
    })
    prior.commit()

    const execute = () =>
      executeCompiledScript(module, metadata(new Uint8Array()), filesystem, {
        moduleImports: () => [
          { module: "sjulia_host", name: "load", kind: "function" },
          { module: "sjulia_host", name: "save", kind: "function" },
        ],
        instantiate: () => ({
          exports: {
            memory,
            __sjulia_alloc: () => 128,
            __sjulia_script_entry: () => {
              throw new WebAssembly.RuntimeError("trap")
            },
            __sjulia_wasm_abi_version: () => 2,
          },
        }),
      })

    await expect(execute).rejects.toThrow("trap")
    expect(filesystem.outputs().map(({ filename }) => filename)).toEqual(["prior.png"])
  })
})
