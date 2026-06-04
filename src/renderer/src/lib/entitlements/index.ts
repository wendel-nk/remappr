// pattern-check: skip — barrel re-export of the entitlements public surface.
export {
    FEATURE_FLAGS,
    type FeatureFlag,
    isFeatureEnabled,
} from './featureFlags'
export {
    licenseKeyHash,
    getLicenseKey,
    setLicenseKey,
    verifyLicense,
    hasPremium,
    type BuilderStage,
    getBuilderStage,
    isBuilderFree,
    hasBuilderAccess,
} from './entitlements'
// `usePremium` is a React hook — it lives in hooks/use-premium.ts (lib/ is
// pure-logic only). Import it from '@/hooks/use-premium'.
