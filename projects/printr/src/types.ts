import { ProtocolState } from '@absinthe/common';

export interface PrintrProtocolState extends ProtocolState {
  activePools: string[];
}
