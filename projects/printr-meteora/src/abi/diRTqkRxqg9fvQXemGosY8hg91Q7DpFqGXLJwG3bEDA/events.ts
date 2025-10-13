import {event} from '../abi.support'
import {CreatePrintrDbcEvent as CreatePrintrDbcEvent_, LzSendMemeEvent as LzSendMemeEvent_} from './types'

export type CreatePrintrDbcEvent = CreatePrintrDbcEvent_

export const CreatePrintrDbcEvent = event(
    {
        d8: '0xd60956f44cbb2f96',
    },
    CreatePrintrDbcEvent_,
)


export type LzSendMemeEvent = LzSendMemeEvent_

export const LzSendMemeEvent = event(
    {
        d8: '0xdb664a117f7472cc',
    },
    LzSendMemeEvent_,
)
