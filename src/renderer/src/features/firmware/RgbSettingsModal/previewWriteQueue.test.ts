import { afterEach, describe, expect, it, vi } from 'vitest'

import { PreviewWriteQueue } from './previewWriteQueue'

describe('PreviewWriteQueue', () => {
    afterEach(() => vi.useRealTimers())

    it('coalesces slider updates into the latest full-state preview', async () => {
        vi.useFakeTimers()
        const writes: number[] = []
        const queue = new PreviewWriteQueue<number>(
            async (value) => {
                writes.push(value)
            },
            90,
            () => undefined,
        )

        queue.schedule(1)
        queue.schedule(2)
        queue.schedule(3)
        await vi.advanceTimersByTimeAsync(90)

        expect(writes).toEqual([3])
    })

    it('flushes and awaits the preview before persistence continues', async () => {
        vi.useFakeTimers()
        const order: string[] = []
        const queue = new PreviewWriteQueue<number>(
            async (value) => {
                await Promise.resolve()
                order.push(`preview:${value}`)
            },
            90,
            () => undefined,
        )

        queue.schedule(42)
        await queue.flush()
        order.push('save')

        expect(order).toEqual(['preview:42', 'save'])
        expect(vi.getTimerCount()).toBe(0)
    })

    it('cancels a preview that has not reached the device', async () => {
        vi.useFakeTimers()
        const write = vi.fn<(_: number) => Promise<void>>()
        const queue = new PreviewWriteQueue(write, 90, () => undefined)

        queue.schedule(7)
        await queue.cancel()
        await vi.runAllTimersAsync()

        expect(write).not.toHaveBeenCalled()
    })
})
