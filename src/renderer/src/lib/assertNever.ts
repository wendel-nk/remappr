// pattern-check: skip — single never-type compile-time exhaustiveness helper
export function assertNever ( value: never ): never {
    throw new Error( `Unexpected value: ${String( value )}` )
}
