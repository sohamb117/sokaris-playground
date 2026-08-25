import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { STARTER_SOURCE } from "../src/examples/starter.ts"
import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "../src/runtime/compiler-contract.ts"
import { executeCompiledScript } from "../src/runtime/script-executor.ts"
import { BrowserImageFileSystem } from "../src/runtime/virtual-filesystem.ts"
import initCompiler, {
  compile_to_wasm,
} from "../src/vendor/subset-julia-compiler/subset_julia_vm_web.js"

const compile = (source: string): unknown =>
  compile_to_wasm(source, {
    source_name: "test.jl",
    opt_level: 2,
    exports: [{ export_name: "main!", function_name: "main!", arg_types: ["Vector{UInt8}"] }],
  })

const compileExport = (
  source: string,
  exportName: string,
  functionName: string,
  argTypes: readonly string[],
): unknown =>
  compile_to_wasm(source, {
    source_name: "edge.jl",
    opt_level: 2,
    exports: [{ export_name: exportName, function_name: functionName, arg_types: [...argTypes] }],
  })

beforeAll(async () => {
  const path = resolve(
    import.meta.dirname,
    "../src/vendor/subset-julia-compiler/subset_julia_vm_web_bg.wasm",
  )
  await initCompiler({ module_or_path: await readFile(path) })
})

describe("vendored general compiler", () => {
  it("compiles top-level scripts with typed image imports", async () => {
    const raw = compile_to_wasm(
      `load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
image = load("inputs/input.png")`,
      {
        source_name: "script.jl",
        opt_level: 2,
        entry_mode: "script",
        imports: [
          {
            module: "sjulia_host",
            name: "load",
            function_name: "load",
            params: ["String"],
            result: "Array{UInt8,3}",
          },
        ],
      },
    )

    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)

    expect(compiled.entryPoint).toBe("__sjulia_script_entry")
    expect(compiled.imports).toEqual([
      {
        module: "sjulia_host",
        name: "load",
        functionName: "load",
        params: ["String"],
        result: "Array{UInt8, 3}",
      },
    ])
    expect(WebAssembly.Module.imports(module)).toEqual([
      { module: "sjulia_host", name: "load", kind: "function" },
    ])
  })

  it("executes browser-backed load and save as a transaction", async () => {
    const raw = compile_to_wasm(
      `load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
function save(path::String, image::Array{UInt8,3})::Nothing
    return
end
image = load("inputs/input.png")
save("outputs/result.png", image)`,
      {
        source_name: "load-save.jl",
        opt_level: 2,
        entry_mode: "script",
        imports: [
          {
            module: "sjulia_host",
            name: "load",
            function_name: "load",
            params: ["String"],
            result: "Array{UInt8,3}",
          },
          {
            module: "sjulia_host",
            name: "save",
            function_name: "save",
            params: ["String", "Array{UInt8,3}"],
          },
        ],
      },
    )
    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([
      {
        filename: "inputs/input.png",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([10, 20, 30, 40]),
      },
    ])

    const outputs = await executeCompiledScript(module, compiled, filesystem)

    expect(outputs).toEqual([
      {
        filename: "outputs/result.png",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([10, 20, 30, 40]),
      },
    ])
  })

  it("compiles and runs the exact helper, loop, and branch starter", async () => {
    // Given
    const compiled = parseCompilerResult(compile(STARTER_SOURCE))
    const module = await WebAssembly.compile(compiled.bytes)
    const data = new Uint8ClampedArray([0, 64, 128, 255, 1, 2, 3, 254])

    // When
    const result = await executeCompiledImage(module, {
      filename: "tiny.png",
      width: 2,
      height: 1,
      data,
    })

    // Then
    expect(result.data).toEqual(new Uint8ClampedArray([255, 191, 127, 255, 254, 253, 252, 254]))
  })

  it("reports an explicit diagnostic for unsupported dynamic String construction", () => {
    // Given
    const result = compile(`function main!(pixels::Vector{UInt8})
    label = String(pixels)
end`)

    // When
    const diagnostic = formatCompilerDiagnostics(result)

    // Then
    expect(diagnostic).toContain("unsupported")
    expect(diagnostic).toContain("Convert")
    expect(diagnostic).toContain("target_ty: Str")
  })

  it("preserves UInt8 wrapping and unsigned widening in the shipped compiler", async () => {
    // Given
    const source = `wrapped()::Int64 = Int64(UInt8(0) - UInt8(1))`
    const compiled = parseCompilerResult(compileExport(source, "wrapped_alias", "wrapped", []))
    const module = await WebAssembly.compile(compiled.bytes)
    const instance = await WebAssembly.instantiate(module, {})

    // When
    const result = Reflect.get(instance.exports, "wrapped_alias")

    // Then
    expect(typeof result).toBe("function")
    if (typeof result === "function") expect(result()).toBe(255n)
    expect(Reflect.get(instance.exports, "wrapped")).toBeUndefined()
  })

  it("rejects an ambiguous implicit return instead of emitting a loop", () => {
    // Given
    const source = `function twice(value::Int64)::Int64
    output = value * 2
    output
end`

    // When
    const diagnostic = formatCompilerDiagnostics(compileExport(source, "twice", "twice", ["Int64"]))

    // Then
    expect(diagnostic).toContain("unsupported")
    expect(diagnostic).toContain("no unambiguous return value")
  })
})
