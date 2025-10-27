import {event} from '../abi.support'
import {DeployTelecoinEvent as DeployTelecoinEvent_, PrintTelecoinEvent as PrintTelecoinEvent_, TeleportWithLzEvent as TeleportWithLzEvent_} from './types'

export type DeployTelecoinEvent = DeployTelecoinEvent_

export const DeployTelecoinEvent = event(
    {
        d8: '0x85d9c1e533c3f862',
    },
    DeployTelecoinEvent_,
)

export type PrintTelecoinEvent = PrintTelecoinEvent_

export const PrintTelecoinEvent = event(
    {
        d8: '0xca07d422cd476f8b',
    },
    PrintTelecoinEvent_,
)

export type TeleportWithLzEvent = TeleportWithLzEvent_

export const TeleportWithLzEvent = event(
    {
        d8: '0xa6aa3d7de0a6e362',
    },
    TeleportWithLzEvent_,
)
