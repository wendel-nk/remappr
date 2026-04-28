// pattern-check: skip back-end swap codemod — routes callRpc through ZmkKeyboardService instead of raw RpcConnection
import { Request, RequestResponse } from '@zmkfirmware/zmk-studio-ts-client'
import useConnectionStore from '@/stores/connectionStore'
import { ZmkKeyboardService } from '@firmware/zmk/service'

export const callRpc = async (
    request: Omit<Request, 'requestId'>,
): Promise<RequestResponse> => {
    const { service } = useConnectionStore.getState()

    if (!service) {
        console.warn('RPC call attempted without active connection')
        return {} as RequestResponse
    }

    return (service as ZmkKeyboardService)
        .callRpc(request)
        .catch((e: unknown): RequestResponse => {
            console.error('RPC Error', e)
            throw e
        })
}
