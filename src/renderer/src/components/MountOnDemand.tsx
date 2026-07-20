// Pattern check: Proxy (Tier 2) — applied — virtual proxy for lazily loaded
// dialogs: renders nothing (so no chunk is fetched) until `when` first turns
// true, then keeps the children mounted so close animations and internal state
// survive subsequent closes.
import { Suspense, useState, type ReactNode } from 'react'

interface MountOnDemandProps {
    when: boolean
    children: ReactNode
}

export function MountOnDemand({
    when,
    children,
}: MountOnDemandProps): JSX.Element | null {
    // Render-phase latch (React's "adjusting state during render" pattern):
    // flips once on first open and never resets.
    const [everOpened, setEverOpened] = useState(false)
    if (when && !everOpened) setEverOpened(true)
    if (!when && !everOpened) return null
    return <Suspense fallback={null}>{children}</Suspense>
}
