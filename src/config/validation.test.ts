import { describe, it, expect } from 'vitest';
import { validateConfigAgainstManifest } from './validation.ts';
import { evmAddress, Manifest } from '../types/manifest.ts';
import { coingeckoFeed } from '../feeds/coingecko.ts';
import { peggedFeed } from '../feeds/pegged.ts';

describe('validateConfigAgainstManifest', () => {
  describe('pricing validation', () => {
    const manifest = {
      name: 'test-adapter',
      version: '1.0.0',
      chainArch: 'evm',
      trackables: {
        swap: {
          kind: 'action',
          quantityType: 'token_based',
          params: {
            poolAddress: evmAddress('The pool address'),
          },
          assetSelectors: {
            tokenAddress: evmAddress('The token to track'),
          },
        },
      },
    } as const satisfies Manifest;

    it('should accept valid pegged pricing config', () => {
      const config = {
        swap: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            assetSelectors: { tokenAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'pegged',
              usdPegValue: 1,
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).not.toThrow();
    });

    it('should reject pegged pricing with wrong field name', () => {
      const config = {
        swap: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            assetSelectors: { tokenAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'pegged',
              usdegValue: 1, // Wrong field name
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).toThrow(/usdPegValue/);
    });

    it('should accept valid coingecko pricing config', () => {
      const config = {
        swap: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            assetSelectors: { tokenAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'coingecko',
              id: 'ethereum',
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).not.toThrow();
    });

    it('should reject coingecko pricing without id', () => {
      const config = {
        swap: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            assetSelectors: { tokenAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'coingecko',
              // Missing 'id' field
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).toThrow(/id/);
    });

    it('should reject unknown feed handler', () => {
      const config = {
        swap: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            assetSelectors: { tokenAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'nonexistent-handler',
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).toThrow(/Unknown feed handler/);
    });
  });

  describe('recursive pricing validation', () => {
    const manifest = {
      name: 'test-adapter',
      version: '1.0.0',
      chainArch: 'evm',
      trackables: {
        lp: {
          kind: 'position',
          quantityType: 'token_based',
          params: {
            poolAddress: evmAddress('The pool address'),
          },
        },
      },
    } as const satisfies Manifest;

    it('should validate nested feed configs recursively', () => {
      const config = {
        lp: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'univ2nav',
              token0: {
                kind: 'coingecko',
                id: 'ethereum',
              },
              token1: {
                kind: 'pegged',
                usdPegValue: 1,
              },
            },
          },
        ],
      };

      // This should not throw if recursive validation works
      expect(() => validateConfigAgainstManifest(config, manifest)).not.toThrow();
    });

    it('should catch errors in nested feed configs', () => {
      const config = {
        lp: [
          {
            params: { poolAddress: '0x1234567890123456789012345678901234567890' },
            pricing: {
              kind: 'univ2nav',
              token0: {
                kind: 'coingecko',
                // Missing 'id' field
              },
              token1: {
                kind: 'pegged',
                usdPegValue: 1,
              },
            },
          },
        ],
      };

      expect(() => validateConfigAgainstManifest(config, manifest)).toThrow(/token0.*id/);
    });
  });
});
