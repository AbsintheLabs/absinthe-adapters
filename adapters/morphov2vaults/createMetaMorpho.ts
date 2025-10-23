// Bid handler for GBM Auctions Legacy
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import * as factoryAbi from './abi/morphofactoryv2.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { Redis } from 'ioredis';
import * as erc20Abi from '../../src/abi/erc20.ts';

export async function handleCreateMetaMorphoFactory(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.createMetaMorphoFactory>,
  vaultAddress: Set<string>,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const decoded = factoryAbi.events.CreateVaultV2.decode({
    topics: log.topics,
    data: log.data,
  });

  const { owner, asset, newVaultV2, salt } = decoded;

  if (!vaultAddress.has(newVaultV2.toLowerCase())) {
    console.warn(`Vault does not match: ${newVaultV2} !== ${vaultAddress}`);
    return;
  }
  const assetContract = new erc20Abi.Contract(sqdRpcCtx, asset);
  const decimals = await assetContract.decimals();

  const marketDataKey = `morpho:vault:${newVaultV2.toLowerCase()}`;
  const marketData = {
    asset: asset.toString(),
    salt: salt.toString(),
    decimals: decimals,
  };

  await redis.set(marketDataKey, JSON.stringify(marketData));
  console.info(`Market created and stored in Redis: ${newVaultV2}`, marketData);

  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'createVaultsV2',
    user: owner.toLowerCase(),
    trackableInstance: instance,
    meta: {
      metaMorpho: newVaultV2.toString(),
      asset: asset.toString(),
      salt: salt.toString(),
    },
  });
}
