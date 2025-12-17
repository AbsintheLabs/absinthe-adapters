import { evmAddress, Manifest } from '../_shared/index.ts';

export const manifest = {
  name: 'printr-mcap',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    tokenTrade: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrContractAddress: evmAddress('The Printr protocol contract address'),
      },
      assetSelectors: {
        tokenAddress: evmAddress('The token being traded'),
      },
    },
    curveCreated: {
      kind: 'action',
      quantityType: 'none',
      params: {
        printrccContractAddress: evmAddress('The Printr protocol contract address'),
      },
    },
    liquidityDeployed: {
      kind: 'action',
      quantityType: 'none',
      params: {
        printrldContractAddress: evmAddress('The Printr protocol contract address'),
      },
    },
    swap: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrContractAddress: evmAddress('The Printr protocol contract address'),
        factoryAddress: evmAddress('The Uniswap V3 factory address'),
      },
      assetSelectors: {
        swapLegAddress: evmAddress('Which token to price (token0 or token1)'),
      },
    },
    hold: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        printrHoldContractAddress: evmAddress('The Printr protocol contract address'),
      },
    },
    // Threshold-specific holder rewards (pro-rata distribution)
    mcap_holders_250000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders250000ContractAddress: evmAddress(
          'The Printr protocol contract address for 250k threshold',
        ),
      },
    },
    mcap_holders_500000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders500000ContractAddress: evmAddress(
          'The Printr protocol contract address for 500k threshold',
        ),
      },
    },
    mcap_holders_1000000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders1000000ContractAddress: evmAddress(
          'The Printr protocol contract address for 1M threshold',
        ),
      },
    },
    mcap_holders_10000000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders10000000ContractAddress: evmAddress(
          'The Printr protocol contract address for 10M threshold',
        ),
      },
    },
    mcap_holders_100000000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders100000000ContractAddress: evmAddress(
          'The Printr protocol contract address for 100M threshold',
        ),
      },
    },
    mcap_holders_1000000000: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapHolders1000000000ContractAddress: evmAddress(
          'The Printr protocol contract address for 1B threshold',
        ),
      },
    },
    // Creator rewards (single config, full points per threshold - no pro-rata)
    mcap_creators: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        printrMcapCreatorsContractAddress: evmAddress('The Printr protocol contract address'),
      },
    },
  },
} as const satisfies Manifest;
