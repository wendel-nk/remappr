// pattern-check: skip — async try/catch wrapper with toast side-effects
import {toast} from 'sonner'

export async function saveWithToast<T> (
    fn: () => Promise<T>,
    successMsg: string | null,
    errorPrefix: string,
): Promise<T | undefined> {
    try {
        const r = await fn()
        if ( successMsg ) toast.success( successMsg )
        return r
    } catch ( e ) {
        const detail = e instanceof Error ? e.message : String( e )
        toast.error( `${errorPrefix}: ${detail}` )
        console.error( e )
        return undefined
    }
}
