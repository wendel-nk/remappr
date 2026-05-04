// pattern-check: skip — thin store-reading wrapper around useFeatureAvailable
import {ReactNode} from 'react'

import {useFeatureAvailable, type Feature} from './useFeatureAvailable'

interface Props {
    feature: Feature
    children: ReactNode
    fallback?: ReactNode
}

export function FeatureGate ( {
    feature,
    children,
    fallback = null,
}: Props ): JSX.Element {
    return <>{useFeatureAvailable( feature ) ? children : fallback}</>
}
