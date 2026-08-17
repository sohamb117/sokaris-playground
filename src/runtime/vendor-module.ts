export type SubsetJuliaModule = {
  readonly default: (input?: URL) => Promise<unknown>
  readonly get_version: () => string
  readonly init: () => void
  readonly run_from_source_typed: (source: string, seed: bigint) => unknown
}
