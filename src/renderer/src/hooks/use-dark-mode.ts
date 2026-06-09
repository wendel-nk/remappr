// Pattern check: no GoF pattern (-) — rejected — single React hook wrapping a MutationObserver dark-class tracker, no abstraction warranted
import { useEffect, useState } from 'react'

/** Track the app's resolved dark/light so Monaco's theme follows it. */
export function useIsDark(): boolean {
    const [dark, setDark] = useState(
        () =>
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark'),
    )
    useEffect(() => {
        const root = document.documentElement
        const obs = new MutationObserver(() =>
            setDark(root.classList.contains('dark')),
        )
        obs.observe(root, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    }, [])
    return dark
}
