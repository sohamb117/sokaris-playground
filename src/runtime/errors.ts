export class RuntimeContractError extends Error {
  readonly name = "RuntimeContractError"
}

export class RuntimeLifecycleError extends Error {
  readonly name = "RuntimeLifecycleError"
}

export class VmVersionError extends Error {
  readonly name = "VmVersionError"

  constructor(readonly actualVersion: string) {
    super(`Expected SubsetJuliaVM v0.12.2, received v${actualVersion}`)
  }
}
