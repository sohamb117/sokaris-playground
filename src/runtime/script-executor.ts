import { createBrowserHostImports } from "./browser-host-imports.ts"
import type { CompilerImport, CompilerSuccess } from "./compiler-contract.ts"
import type { BrowserImageSource } from "./types.ts"
import type { BrowserImageFileSystem } from "./virtual-filesystem.ts"

type ModuleImport = {
  readonly module: string
  readonly name: string
  readonly kind: string
}

type ScriptInstance = { readonly exports: WebAssembly.Exports }

type ScriptExecutorDependencies = {
  readonly moduleImports?: (module: WebAssembly.Module) => readonly ModuleImport[]
  readonly instantiate?: (
    module: WebAssembly.Module,
    imports: WebAssembly.Imports,
  ) => ScriptInstance | Promise<ScriptInstance>
}

const EXPECTED_IMPORTS = new Map([
  ["sjulia_host.load", "String->Array{UInt8, 3}"],
  ["sjulia_host.save", "String,Array{UInt8, 3}->Nothing"],
])

const importIdentity = (value: { readonly module: string; readonly name: string }): string =>
  `${value.module}.${value.name}`

const importSignature = (value: CompilerImport): string =>
  `${value.params.join(",")}->${value.result ?? "Nothing"}`

export const validateScriptImports = (
  declared: readonly CompilerImport[],
  actual: readonly ModuleImport[],
): void => {
  const declaredIdentities = declared.map(importIdentity).sort()
  const actualIdentities = actual
    .filter(({ kind }) => kind === "function")
    .map(importIdentity)
    .sort()
  const signaturesMatch = declared.every(
    (entry) => EXPECTED_IMPORTS.get(importIdentity(entry)) === importSignature(entry),
  )
  if (
    actual.some(({ kind }) => kind !== "function") ||
    JSON.stringify(declaredIdentities) !== JSON.stringify(actualIdentities) ||
    !signaturesMatch
  ) {
    throw new TypeError("Compiled module imports do not match compiler metadata")
  }
}

const requireExport = (exports: WebAssembly.Exports, name: string): CallableFunction => {
  const value = Reflect.get(exports, name)
  if (typeof value !== "function") throw new TypeError(`Compiled script is missing ${name}`)
  return value
}

const requireMemory = (exports: WebAssembly.Exports): WebAssembly.Memory => {
  const memory = Reflect.get(exports, "memory")
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new TypeError("Compiled script is missing memory")
  }
  return memory
}

export const executeCompiledScript = async (
  module: WebAssembly.Module,
  compiled: CompilerSuccess,
  filesystem: BrowserImageFileSystem,
  dependencies: ScriptExecutorDependencies = {},
): Promise<readonly BrowserImageSource[]> => {
  if (compiled.entryPoint === undefined)
    throw new TypeError("Compiler did not return a script entry")
  const moduleImports = dependencies.moduleImports ?? WebAssembly.Module.imports
  validateScriptImports(compiled.imports, moduleImports(module))
  const run = filesystem.beginRun()
  let exports: WebAssembly.Exports | undefined
  const host = () => {
    if (exports === undefined)
      throw new TypeError("Compiled script imports ran before instantiation")
    const allocate = requireExport(exports, "__sjulia_alloc")
    return createBrowserHostImports({
      memory: requireMemory(exports),
      allocate: (size, alignment) => Number(allocate(size, alignment)),
      filesystem,
      run,
    }).sjulia_host
  }
  const imports = {
    sjulia_host: {
      load: (path: number): number => host().load(path),
      save: (path: number, descriptor: number): void => host().save(path, descriptor),
    },
  }
  const instantiate = dependencies.instantiate ?? WebAssembly.instantiate
  try {
    const instance = await instantiate(module, imports)
    exports = instance.exports
    if (requireExport(exports, "__sjulia_wasm_abi_version")() !== 2) {
      throw new TypeError("Compiled script ABI version must be 2")
    }
    requireExport(exports, compiled.entryPoint)()
    run.commit()
    return filesystem.outputs()
  } catch (error) {
    run.rollback()
    throw error
  }
}
