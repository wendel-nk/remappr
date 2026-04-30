// pattern-check: skip — thin store-reading wrapper, no abstraction warranted
import { ReactNode } from 'react'
import useConnectionStore from '@/stores/connectionStore'

export type Feature =
    | 'encoders'
    | 'dynamic'
    | 'macros'
    | 'wireless'
    | 'rgb'
    | 'lock'
    | 'rename'
    | 'reorderLayers'
    | 'variableLayerCount'
    | 'layoutSideloadable'

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
            case 'wireless':
                return !!service.wireless
            case 'rgb':
                return !!service.rgb
            case 'lock':
                return service.capabilities.lock
            case 'rename':
                return service.capabilities.rename
            case 'reorderLayers':
                return service.capabilities.reorderLayers
            case 'variableLayerCount':
                return service.capabilities.variableLayerCount
            case 'layoutSideloadable':
                return !!service.capabilities.layoutSideloadable
            default:
                return false
        }
    })()
    return <>{present ? children : fallback}</>
}
