import { ProtocolState } from '@absinthe/common';

export interface PrintrProtocolState extends ProtocolState {
  activePools: string[];
  tokens: {
    [key: string]: {
      token0: { id: string; decimals: number };
      token1: { id: string; decimals: number };
    };
  };
}
