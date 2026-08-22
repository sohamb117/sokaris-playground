export class CompilerModuleCache {
  private readonly modules = new Map<string, WebAssembly.Module>()
  private readonly inFlight = new Map<string, Promise<WebAssembly.Module>>()

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError("Compiler cache capacity must be a positive integer")
    }
  }

  async get(key: string, compile: () => Promise<WebAssembly.Module>): Promise<WebAssembly.Module> {
    const cached = this.modules.get(key)
    if (cached !== undefined) return cached
    const pending = this.inFlight.get(key)
    if (pending !== undefined) return pending
    const compilation = compile()
    this.inFlight.set(key, compilation)
    let module: WebAssembly.Module
    try {
      module = await compilation
    } finally {
      this.inFlight.delete(key)
    }
    if (this.modules.size >= this.capacity) {
      const oldest = this.modules.keys().next().value
      if (typeof oldest === "string") this.modules.delete(oldest)
    }
    this.modules.set(key, module)
    return module
  }
}
