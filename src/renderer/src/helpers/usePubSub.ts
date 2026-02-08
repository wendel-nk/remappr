import Emittery from 'emittery'
import { useCallback, useEffect } from 'react'

const emitter = new Emittery()

// For non-React contexts
export const publish = (name: PropertyKey, data: unknown): void => {
    emitter.emit(name, data)
}

export const usePub =
    (): ((name: PropertyKey, data: unknown) => void) =>
    (name: PropertyKey, data: unknown): void => {
        emitter.emit(name, data)
    }

export const useSub = (
    name: PropertyKey,
    callback: (data: unknown) => void | Promise<void>,
): (() => void) => {
    const unsub = (): void => {
        console.log('unsub', name)
        emitter.off(name, callback)
    }

    // Be sure we unsub if unmounted.
    useEffect((): (() => void) => {
        emitter.on(name, callback)
        return (): void => unsub()
    })

    return unsub
}

export const useEmitter = (): {
    publish: (event: PropertyKey, data: unknown) => void
    subscribe: (
        event: PropertyKey,
        callback: (data: unknown) => void | Promise<void>,
    ) => () => void
} => {
    // Memoized publish function to emit events
    const publish = useCallback((event: PropertyKey, data: unknown): void => {
        emitter.emit(event, data)
    }, [])

    // Memoized subscribe function that returns an unsubscribe function
    const subscribe = useCallback(
        (
            event: PropertyKey,
            callback: (data: unknown) => void | Promise<void>,
        ): (() => void) => {
            // console.log('unsub', event,callback)
            emitter.on(event, callback)
            return (): void => emitter.off(event, callback)
        },
        [],
    )

    return { publish, subscribe }
}
