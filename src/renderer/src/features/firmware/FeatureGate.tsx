// pattern-check: skip — thin store-reading wrapper, no abstraction warranted
import { ReactNode } from 'react'
import useConnectionStore from '@/stores/connectionStore'

export type Feature =
    | 'encoders'
    | 'dynamic'
    | 'macros'
    | 'lock'
    | 'rename'
    | 'reorderLayers'
    | 'variableLayerCount'

interface Props {
    feature: Feature
    children: ReactNode
    fallback?: ReactNode
}

export function FeatureGate({
    feature,
    children,
    fallback = null,
}: Props): JSX.Element {
    const { service } = useConnectionStore()
    if (!service) return <>{fallback}</>
    const present = (() => {
        switch (feature) {
            case 'encoders':
                return !!service.encoders
            case 'dynamic':
                return !!service.dynamic
            case 'macros':
                return !!service.macros
            case 'lock':
                return service.capabilities.lock
            case 'rename':
                return service.capabilities.rename
            case 'reorderLayers':
                return service.capabilities.reorderLayers
            case 'variableLayerCount':
                return service.capabilities.variableLayerCount
            default:
                return false
        }
    })()
    return <>{present ? children : fallback}</>
}
