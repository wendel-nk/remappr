// Pattern check: no GoF pattern (-) — rejected — bug fix for round-trip mismatch and effect dep churn, no abstraction needed
import {type Dispatch, type SetStateAction, useEffect, useState} from 'react'

function basicSerialize<T> ( value: T ): string {
    if ( typeof value === 'object' ) {
        return JSON.stringify( value )
    }
    return String( value )
}

function basicDeserialize<T> ( value: string ): T {
    try {
        return JSON.parse( value ) as T
    } catch {
        return value as T
    }
}

export function useLocalStorageState<T> (
    key: string,
    defaultValue: T,
    options?: {
        serialize?: ( value: T ) => string
        deserialize?: ( value: string ) => T
    },
): [T, Dispatch<SetStateAction<T>>] {
    const serialize = options?.serialize
    const deserialize = options?.deserialize

    const reactState = useState<T>( () => {
        const savedValue = localStorage.getItem( key )
        if ( savedValue !== null ) {
            return deserialize
                ? deserialize( savedValue )
                : basicDeserialize<T>( savedValue )
        }
        return defaultValue
    } )

    const [state] = reactState

    useEffect( () => {
        const serializedState = serialize
            ? serialize( state )
            : basicSerialize( state )
        localStorage.setItem( key, serializedState )
    }, [state, key, serialize, deserialize] )

    return reactState
}
