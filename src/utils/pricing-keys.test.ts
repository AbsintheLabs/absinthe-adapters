import { describe, it, expect } from 'vitest';
import { extractAssetKeyFromPricingKey, buildPricingKey } from './pricing-keys.ts';

describe('pricing-keys utilities', () => {
  describe('extractAssetKeyFromPricingKey', () => {
    it('should extract ERC20 asset key', () => {
      const pricingKey = 'pricing:erc20:0x1234567890123456789012345678901234567890:abcd1234';
      const assetKey = extractAssetKeyFromPricingKey(pricingKey);
      expect(assetKey).toBe('erc20:0x1234567890123456789012345678901234567890');
    });

    it('should extract ERC721 asset key with tokenId', () => {
      const pricingKey = 'pricing:erc721:0x1234567890123456789012345678901234567890:42:a1b2c3d4';
      const assetKey = extractAssetKeyFromPricingKey(pricingKey);
      expect(assetKey).toBe('erc721:0x1234567890123456789012345678901234567890:42');
    });

    it('should extract SPL asset key', () => {
      const pricingKey = 'pricing:spl:SomeBase58Address:12345678';
      const assetKey = extractAssetKeyFromPricingKey(pricingKey);
      expect(assetKey).toBe('spl:SomeBase58Address');
    });

    it('should extract custom asset key with multiple colons', () => {
      const pricingKey = 'pricing:custom:myprefix:mykey:deadbeef';
      const assetKey = extractAssetKeyFromPricingKey(pricingKey);
      expect(assetKey).toBe('custom:myprefix:mykey');
    });

    it('should throw error for missing pricing prefix', () => {
      const invalidKey = 'erc20:0xabc:12345678';
      expect(() => extractAssetKeyFromPricingKey(invalidKey)).toThrow(/expected to start with/);
    });

    it('should throw error for invalid hash length', () => {
      const invalidKey = 'pricing:erc20:0xabc:123'; // Hash too short
      expect(() => extractAssetKeyFromPricingKey(invalidKey)).toThrow(/expected hash length/);
    });

    it('should throw error for missing colon', () => {
      const invalidKey = 'pricing:erc20'; // No hash separator
      expect(() => extractAssetKeyFromPricingKey(invalidKey)).toThrow(/no colon found/);
    });

    it('should throw error for empty asset key', () => {
      const invalidKey = 'pricing::12345678'; // Empty asset key
      expect(() => extractAssetKeyFromPricingKey(invalidKey)).toThrow(/empty asset key/);
    });
  });

  describe('buildPricingKey', () => {
    it('should build pricing key for ERC20', () => {
      const assetKey = 'erc20:0x1234567890123456789012345678901234567890';
      const feedHash = 'abcd1234';
      const pricingKey = buildPricingKey(assetKey, feedHash);
      expect(pricingKey).toBe('pricing:erc20:0x1234567890123456789012345678901234567890:abcd1234');
    });

    it('should build pricing key for ERC721 with tokenId', () => {
      const assetKey = 'erc721:0x1234567890123456789012345678901234567890:42';
      const feedHash = 'a1b2c3d4';
      const pricingKey = buildPricingKey(assetKey, feedHash);
      expect(pricingKey).toBe(
        'pricing:erc721:0x1234567890123456789012345678901234567890:42:a1b2c3d4',
      );
    });

    it('should throw error for invalid hash length', () => {
      const assetKey = 'erc20:0xabc';
      const invalidHash = '123'; // Too short
      expect(() => buildPricingKey(assetKey, invalidHash)).toThrow(/Invalid feed hash length/);
    });
  });

  describe('round-trip conversion', () => {
    const testCases = [
      {
        name: 'ERC20',
        assetKey: 'erc20:0x1234567890123456789012345678901234567890',
        feedHash: 'abcd1234',
      },
      {
        name: 'ERC721',
        assetKey: 'erc721:0x1234567890123456789012345678901234567890:42',
        feedHash: 'deadbeef',
      },
      {
        name: 'SPL',
        assetKey: 'spl:SomeBase58Address',
        feedHash: '12345678',
      },
      {
        name: 'Custom with multiple colons',
        assetKey: 'custom:myprefix:mykey',
        feedHash: 'cafebabe',
      },
    ];

    testCases.forEach(({ name, assetKey, feedHash }) => {
      it(`should round-trip ${name}`, () => {
        const pricingKey = buildPricingKey(assetKey, feedHash);
        const extractedAssetKey = extractAssetKeyFromPricingKey(pricingKey);
        expect(extractedAssetKey).toBe(assetKey);
      });
    });
  });
});
