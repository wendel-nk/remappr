// pattern-check: skip — thin facade impl wrapping HidClient.send calls; data marshalling only
import type {HidClient} from '@firmware/hid/rawHidClient'
import type {HsvColor, IndicatorConfig, RgbApi} from '@firmware/service'

import {
    getIndicatorsConfigCmd,
    getLedCountCmd,
    getMixedEffectCmd,
    getMixedRegionsCmd,
    getPerKeyColorCmd,
    getPerKeyTypeCmd,
    parseIndicatorsConfig,
    parseLedCount,
    parseMixedEffect,
    parseMixedRegions,
    parsePerKeyColor,
    parsePerKeyType,
    rgbSaveCmd,
    setIndicatorsConfigCmd,
    setMixedEffectCmd,
    setMixedRegionsCmd,
    setPerKeyColorCmd,
    setPerKeyTypeCmd,
} from './protocol'

export function createRgbFacade ( client: HidClient ): RgbApi {
    return {
        async getLedCount (): Promise<number> {
            const resp = await client.send( getLedCountCmd() )
            return parseLedCount( resp )
        },
        async getIndicators (): Promise<IndicatorConfig> {
            const resp = await client.send( getIndicatorsConfigCmd() )
            return parseIndicatorsConfig( resp )
        },
        async setIndicators ( cfg: IndicatorConfig ): Promise<void> {
            await client.send( setIndicatorsConfigCmd( cfg.raw ) )
        },
        async save (): Promise<void> {
            await client.send( rgbSaveCmd() )
        },
        async getPerKeyType (): Promise<number> {
            const resp = await client.send( getPerKeyTypeCmd() )
            return parsePerKeyType( resp )
        },
        async setPerKeyType ( type: number ): Promise<void> {
            await client.send( setPerKeyTypeCmd( type ) )
        },
        async getPerKeyColors (
            startLed: number,
            count: number,
        ): Promise<HsvColor[]> {
            const resp = await client.send( getPerKeyColorCmd( startLed, count ) )
            return parsePerKeyColor( resp, count )
        },
        async setPerKeyColors (
            startLed: number,
            colors: HsvColor[],
        ): Promise<void> {
            await client.send( setPerKeyColorCmd( startLed, colors ) )
        },
        async getMixedRegions (): Promise<Uint8Array> {
            const resp = await client.send( getMixedRegionsCmd() )
            return parseMixedRegions( resp )
        },
        async setMixedRegions ( payload: Uint8Array ): Promise<void> {
            await client.send( setMixedRegionsCmd( payload ) )
        },
        async getMixedEffect (): Promise<Uint8Array> {
            const resp = await client.send( getMixedEffectCmd() )
            return parseMixedEffect( resp )
        },
        async setMixedEffect ( payload: Uint8Array ): Promise<void> {
            await client.send( setMixedEffectCmd( payload ) )
        },
    }
}
