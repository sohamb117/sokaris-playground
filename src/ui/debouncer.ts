export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly delay: number) {}

  schedule(action: () => void): void {
    this.cancel()
    this.timer = setTimeout(() => {
      this.timer = undefined
      action()
    }, this.delay)
  }

  cancel(): void {
    if (this.timer === undefined) return
    clearTimeout(this.timer)
    this.timer = undefined
  }

  dispose(): void {
    this.cancel()
  }
}
