import {
    call_rpc,
    Request,
    RequestResponse,
} from '@zmkfirmware/zmk-studio-ts-client'
import useConnectionStore from '@/stores/connectionStore.ts'

export const callRemoteProcedureControl = async (
    request: Omit<Request, 'requestId'>,
): Promise<RequestResponse> => {
    const { connection } = useConnectionStore.getState()

    if (!connection) {
        console.warn('RPC call attempted without active connection')
        return {} as RequestResponse
    }
    // console.trace('RPC Request', conn, req);
    console.log(connection, request)

    return call_rpc(connection, request)
        .then((r: RequestResponse): RequestResponse => {
            // console.log('RPC Response', r);
            return r
        })
        .catch((e: unknown): RequestResponse => {
            // console.log('RPC Error', e);
            console.error('RPC Error', e)
            throw e
        })
}
