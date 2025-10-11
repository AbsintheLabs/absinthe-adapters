// Filter enricher to exclude protocol contracts (non-human-controlled accounts) when configured
import { Enricher } from '../core.ts';

/**
 * Filter enricher that excludes protocol contracts when excludeContractAccounts is enabled.
 * Returns undefined for protocol contracts (causing them to be filtered out of the pipeline).
 *
 * Keeps human-controlled accounts:
 * - Standard EOAs (no bytecode)
 * - EIP-7702 Delegated EOAs (0xef01 prefix)
 * - ERC-4337 Smart Accounts (validateUserOp selector)
 *
 * Filters out protocol contracts:
 * - Uniswap pools, Aave vaults, DAOs, etc.
 *
 * Requires:
 * - item.user: the address to check
 * - ctx.appCfg.excludeContractAccounts: boolean flag
 * - ctx.eoaDetector: account detector instance
 *
 * @returns The item unchanged if it should be included, undefined if it should be filtered out
 */
export function excludeContractAccounts<T extends { user: string }>(): Enricher<T, T | undefined> {
  return async (item, ctx) => {
    // If the feature is not enabled, pass through
    if (!ctx.appCfg?.excludeContractAccounts) {
      return item;
    }

    // If no detector available, pass through (safe default)
    if (!ctx.eoaDetector) {
      return item;
    }

    // Check if the user is human-controlled (EOA, EIP-7702, or ERC-4337)
    const isHuman = await ctx.eoaDetector.isHumanControlled(item.user);

    // If it's human-controlled, keep it; otherwise filter it out
    return isHuman ? item : undefined;
  };
}
