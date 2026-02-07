// Pricing configurations for different assets

import { AssetFeedConfig } from '../types/pricing';

// GAMMA VAULTS configuration
export const gammaVaultsFeedConfig: AssetFeedConfig = {
  '0xd317b3bc6650fc6c128b672a12ae22e66027185f': {
    assetType: 'erc20',
    priceFeed: {
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
    },
  },
  '0x7eccd6d077e4ad7120150578e936a22f058fbcce': {
    assetType: 'erc20',
    priceFeed: {
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
    },
  },
  '0xdb7608614dfdd9febfc1b82a7609420fa7b3bc34': {
    assetType: 'erc20',
    priceFeed: {
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
    },
  },
};

// ICHI VAULTS configuration (commented examples from original code)
export const ichiVaultsFeedConfig: AssetFeedConfig = {
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

// Example configurations for future use
export const exampleConfigs = {
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

// Default feed configuration (currently using gamma vaults)
export const defaultFeedConfig = gammaVaultsFeedConfig;