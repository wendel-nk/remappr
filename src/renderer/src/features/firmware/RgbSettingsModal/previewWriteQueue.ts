// One ordered, latest-value debounce queue for full-state device previews.
// flush() is the persistence barrier: callers await it before save().
export class PreviewWriteQueue<T> {
    private pending: T | undefined
    private timer: ReturnType<typeof setTimeout> | null = null
    private inFlight: Promise<void> = Promise.resolve()

    constructor(
        private readonly write: (value: T) => Promise<void>,
        private readonly delayMs: number,
        private readonly onBackgroundError: (error: unknown) => void,
    ) {}

    schedule(value: T): void {
        this.pending = value
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
            this.timer = null
            void this.flush().catch(this.onBackgroundError)
        }, this.delayMs)
    }

    async flush(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
        const next = this.pending
        this.pending = undefined
        if (next !== undefined) {
            // A newer full-state preview supersedes a failed older one. Writes
            // still stay ordered, and flush resolves only after the latest.
            this.inFlight = this.inFlight
                .catch(() => undefined)
                .then(() => this.write(next))
        }
        await this.inFlight
    }

    async cancel(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
        this.pending = undefined
        await this.inFlight.catch(() => undefined)
    }
}
