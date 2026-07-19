// pattern-check: skip — static section descriptor list split out of RgbSheetNav so
// the component file only exports components (react-refresh rule); pure data.
import {
    CircleDot,
    Grid3x3,
    Layers,
    SlidersHorizontal,
    Sparkles,
    Sun,
} from 'lucide-react'

import type { RgbSheetSection } from '@/stores/rgbSheetStore'
import type { RgbApi } from '@firmware/service'

export const SECTIONS: {
    id: RgbSheetSection
    label: string
    icon: typeof Sun
}[] = [
    { id: 'backlight', label: 'Backlight', icon: Sun },
    { id: 'perkey', label: 'Per-key RGB', icon: Grid3x3 },
    { id: 'mix', label: 'Mix RGB', icon: Layers },
    { id: 'underglow', label: 'Underglow', icon: Sparkles },
    { id: 'indicator', label: 'Indicator Light', icon: CircleDot },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
]

export function sectionsForRgb(rgb: RgbApi | undefined): typeof SECTIONS {
    return SECTIONS.filter(({ id }) => {
        if (!rgb) return id === 'backlight'
        const isUnderglow = rgb.effectCatalog?.kind === 'zmk_underglow'
        switch (id) {
            case 'backlight':
                return !!rgb.getEffect && !isUnderglow
            case 'underglow':
                return !!rgb.getEffect && isUnderglow
            case 'perkey':
                return !!rgb.getPerKeyColors && !!rgb.setPerKeyColors
            case 'mix':
            case 'advanced':
                return !!rgb.getMixedRegions && !!rgb.setMixedRegions
            case 'indicator':
                return !!rgb.getIndicators && !!rgb.setIndicators
        }
    })
}
