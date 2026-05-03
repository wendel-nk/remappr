// pattern-check: skip — async try/catch wrapper with toast side-effects
import { toast } from 'sonner'

export async function saveWithToast(
    fn: () => Promise<void>,
    successMsg: string,
    errorPrefix: string,
): Promise<void> {
    try {
        await fn()
        toast.success(successMsg)
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        toast.error(`${errorPrefix}: ${detail}`)
        console.error(e)
    }
}
