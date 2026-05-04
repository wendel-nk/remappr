// pattern-check: skip — store-reading hook + dispatch table for capability lookup
import type { KeyboardService } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'

type ServiceProbe = (s: KeyboardService) => unknown

export const FEATURE_PROBES = {
    encoders: (s) => s.encoders,
    dynamic: (s) => s.dynamic,
    macros: (s) => s.macros,
    wireless: (s) => s.wireless,
    rgb: (s) => s.rgb,
    lock: (s) => s.capabilities.lock,
    rename: (s) => s.capabilities.rename,
    reorderLayers: (s) => s.capabilities.reorderLayers,
    variableLayerCount: (s) => s.capabilities.variableLayerCount,
    layoutSideloadable: (s) => s.capabilities.layoutSideloadable,
} satisfies Record<string, ServiceProbe>

export type Feature = keyof typeof FEATURE_PROBES

export function useFeatureAvailable(feature: Feature): boolean {
    const service = useConnectionStore((s) => s.service)
    return !!service && !!FEATURE_PROBES[feature](service)
}
