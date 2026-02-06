// Initialization handler for Concrete vaults
import { SqdRpcCtx } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { Redis } from 'ioredis';
import * as erc20Abi from '../../src/abi/erc20.ts';
import * as concreteAbi from './abi/concrete.ts';
import { logger } from '../../src/utils/logger.ts';

export async function initializeVaults(
  vaultAddresses: Set<string>,
  rpcCtx: SqdRpcCtx,
  redis: Redis,
): Promise<void> {
  logger.info(`Initializing ${vaultAddresses.size} Concrete vault(s) from config...`);

  for (const vaultAddress of vaultAddresses) {
    const vaultAddr = vaultAddress.toLowerCase();

    try {
      // Check if already initialized in Redis
      const marketDataKey = `concrete:vault:${vaultAddr}`;
      const existingData = await redis.get(marketDataKey);

      if (existingData) {
        logger.debug(`Vault ${vaultAddr} already initialized in Redis, skipping`);
        continue;
      }
      // Create vault contract instance
      const vaultContract = new concreteAbi.Contract(rpcCtx, vaultAddr);

      // Fetch underlying asset address from vault contract
      const underlyingAssetAddress = await vaultContract.asset();
      const assetAddress = underlyingAssetAddress.toLowerCase();

      // Create ERC20 contract instance for underlying asset
      const assetContract = new erc20Abi.Contract(rpcCtx, assetAddress);

      // Fetch decimals from underlying asset contract
      const decimals = await assetContract.decimals();

      // Prepare market data to store in Redis
      const marketData = {
        asset: assetAddress,
        decimals: Number(decimals),
      };

      // Store in Redis (matching the format expected by feed handler)
      await redis.set(marketDataKey, JSON.stringify(marketData));
      logger.info(`Initialized vault ${vaultAddr}: asset=${assetAddress}, decimals=${decimals}`);
    } catch (error) {
      logger.error(`Failed to initialize vault ${vaultAddr}:`, error);
      const msg =
        `Vault init failed for ${vaultAddr}. Please check: (1) fromBlock is not before the contract was deployed, ` +
        `(2) contract address is correct for this chain, (3) RPC has archival support for the block you are querying.`;
      throw new Error(msg);
    }
  }

  logger.info(`Completed initialization of Concrete vaults`);
}
