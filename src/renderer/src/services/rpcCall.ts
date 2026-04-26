import {
    call_rpc,
    Request,
    RequestResponse,
} from '@zmkfirmware/zmk-studio-ts-client'
import useConnectionStore from '@/stores/connectionStore'

export const callRpc = async (
    request: Omit<Request, 'requestId'>,
): Promise<RequestResponse> => {
    const { connection } = useConnectionStore.getState()

    if (!connection) {
        console.warn('RPC call attempted without active connection')
        return {} as RequestResponse
    }

    return call_rpc(connection, request).catch(
        (e: unknown): RequestResponse => {
            console.error('RPC Error', e)
            throw e
        },
    )
}
