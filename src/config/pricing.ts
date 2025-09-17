// Pricing configurations for different assets

import { AssetFeedConfig } from '../config/schema.ts';

// GAMMA VAULTS configuration (legacy format - kept for backward compatibility)
export const gammaVaultsFeedConfigLegacy = {
  '0xd317b3bc6650fc6c128b672a12ae22e66027185f': {
    assetType: 'erc20' as const,
    priceFeed: {
      kind: 'ichinav' as const,
      token0: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'pegged' as const, usdPegValue: 1 },
      },
      token1: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'coingecko' as const, id: 'bitcoin' },
      },
    },
  },
  '0x7eccd6d077e4ad7120150578e936a22f058fbcce': {
    assetType: 'erc20' as const,
    priceFeed: {
      kind: 'ichinav' as const,
      token0: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'coingecko' as const, id: 'ethereum' },
      },
      token1: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'pegged' as const, usdPegValue: 1 },
      },
    },
  },
  '0xdb7608614dfdd9febfc1b82a7609420fa7b3bc34': {
    assetType: 'erc20' as const,
    priceFeed: {
      kind: 'ichinav' as const,
      token0: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'coingecko' as const, id: 'ethereum' },
      },
      token1: {
        assetType: 'erc20' as const,
        priceFeed: { kind: 'coingecko' as const, id: 'bitcoin' },
      },
    },
  },
};

// New rule-based GAMMA VAULTS configuration
export const gammaVaultsFeedConfig: AssetFeedConfig = [
  {
    match: { key: '0xd317b3bc6650fc6c128b672a12ae22e66027185f' },
    config: {
      assetType: 'erc20',
      priceFeed: {
        kind: 'ichinav',
        token0: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
        token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
      },
    },
  },
  {
    match: { key: '0x7eccd6d077e4ad7120150578e936a22f058fbcce' },
    config: {
      assetType: 'erc20',
      priceFeed: {
        kind: 'ichinav',
        token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
        token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
      },
    },
  },
  {
    match: { key: '0xdb7608614dfdd9febfc1b82a7609420fa7b3bc34' },
    config: {
      assetType: 'erc20',
      priceFeed: {
        kind: 'ichinav',
        token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
        token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
      },
    },
  },
];

// ICHI VAULTS configuration (commented examples from original code)
export const ichiVaultsFeedConfigLegacy = {
  // '0xa18a0fc8bf43a18227742b4bf8f2813b467804c6': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'ichinav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
  //   },
  // },
  // '0x983ef679f2913c0fa447dd7518404b7d07198291': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'ichinav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
  //   },
  // },
  // '0x423fc440a2b61fc1e81ecc406fdf70d36929c680': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'ichinav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
  //   },
  // },
  // '0xf399dafcb98f958474e736147d9d35b2a3cae3e0': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'ichinav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
  //   },
  // },
};

// New rule-based ICHI VAULTS configuration
export const ichiVaultsFeedConfig: AssetFeedConfig = [
  // Add rules here when needed
];

// UNISWAP V3 configuration for specific pool
export const univ3FeedConfig: AssetFeedConfig = [
  // Rule 1: Match all Uniswap V3 positions in the specific pool
  {
    match: {
      matchLabels: {
        protocol: 'uniswap-v3',
        pool: '0x92787e904d925662272f3776b8a7f0b8f92f9bb5',
      },
    },
    config: {
      assetType: 'erc721',
      priceFeed: {
        kind: 'univ3lp',
        nonfungiblepositionmanager: '0xc36442b4a4522e871399cd717abdd847ab11fe88', // Mainnet NFPM
        token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'usd-coin' } }, // USDC
        token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'wrapped-bitcoin' } }, // WBTC
      },
    },
  },
  // Rule 2: Fallback for any Uniswap V3 positions (broader match)
  {
    match: {
      matchLabels: {
        protocol: 'uniswap-v3',
      },
    },
    config: {
      assetType: 'erc721',
      priceFeed: {
        kind: 'univ3lp',
        nonfungiblepositionmanager: '0xc36442b4a4522e871399cd717abdd847ab11fe88', // Mainnet NFPM
        token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'usd-coin' } }, // Default to USDC
        token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'wrapped-ethereum' } }, // Default to WETH
      },
    },
  },
];

// Example configurations for future use (legacy format)
export const exampleConfigsLegacy = {
  // spl example
  // 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': {
  //   assetType: 'spl',
  //   priceFeed: {
  //     kind: 'coingecko',
  //     id: 'jupiter-staked-sol'
  //   }
  // },
  // univ2 pool example
  // '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'univ2nav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'pepe' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } }
  //   }
  // },
  // '0x423fc440a2b61fc1e81ecc406fdf70d36929c680': {
};

// New rule-based example configurations
export const exampleConfigs: AssetFeedConfig = [
  // SPL token example
  // {
  //   match: { key: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v' },
  //   config: {
  //     assetType: 'spl',
  //     priceFeed: { kind: 'coingecko', id: 'jupiter-staked-sol' }
  //   }
  // },
  // Uniswap V2 pool example
  // {
  //   match: { key: '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f' },
  //   config: {
  //     assetType: 'erc20',
  //     priceFeed: {
  //       kind: 'univ2nav',
  //       token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'pepe' } },
  //       token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } }
  //     }
  //   }
  // },
];

// Combined feed configuration with all rules
export const combinedFeedConfig: AssetFeedConfig = [
  // Uniswap V3 rules (highest priority - specific pool first)
  ...univ3FeedConfig,
  // Gamma Vault rules
  ...gammaVaultsFeedConfig,
  // Ichi Vault rules
  ...ichiVaultsFeedConfig,
];

// Default feed configuration (now using combined rule-based config)
export const defaultFeedConfig = combinedFeedConfig;
