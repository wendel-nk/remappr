import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { callRpc } from '@/services/rpcCall'
import type { BehaviorMap } from '@/lib/behaviors/types'

export async function fetchAllBehaviors(
    isCancelled: () => boolean,
): Promise<BehaviorMap> {
    const listRequest = {
        behaviors: { listAllBehaviors: true },
        requestId: 0,
    }

    const behaviorListResponse = await callRpc(listRequest)
    if (isCancelled()) return {}

    const behaviorMap: BehaviorMap = {}
    const behaviorIds =
        behaviorListResponse?.behaviors?.listAllBehaviors?.behaviors || []

    for (const behaviorId of behaviorIds) {
        if (isCancelled()) break

        const detailsRequest = {
            behaviors: { getBehaviorDetails: { behaviorId } },
            requestId: 0,
        }
        const detailsResponse = await callRpc(detailsRequest)
        const details: GetBehaviorDetailsResponse | undefined =
            detailsResponse?.behaviors?.getBehaviorDetails

        if (details) behaviorMap[details.id] = details
    }

    return behaviorMap
}
