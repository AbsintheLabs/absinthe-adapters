// Bid handler for GBM Auctions Legacy
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import * as factoryAbi from './abi/morphofactoryv1.ts';
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
  const decoded = factoryAbi.events.CreateMetaMorpho.decode({
    topics: log.topics,
    data: log.data,
  });

  const { metaMorpho, asset, caller, name, symbol, salt } = decoded;

  if (!vaultAddress.has(metaMorpho.toLowerCase())) {
    console.warn(`Vault does not match: ${metaMorpho} !== ${vaultAddress}`);
    return;
  }
  const assetContract = new erc20Abi.Contract(sqdRpcCtx, asset);
  const decimals = await assetContract.decimals();

  const marketDataKey = `morpho:vault:${metaMorpho.toLowerCase()}`;
  const marketData = {
    asset: asset.toString(),
    name: name.toString(),
    symbol: symbol.toString(),
    salt: salt.toString(),
    decimals: decimals,
  };

  await redis.set(marketDataKey, JSON.stringify(marketData));
  console.info(`Market created and stored in Redis: ${metaMorpho}`, marketData);

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'createMetaMorphoFactory',
    user: caller.toLowerCase(),
    trackableInstance: instance,
    meta: {
      metaMorpho: metaMorpho.toString(),
      asset: asset.toString(),
      name: name.toString(),
      symbol: symbol.toString(),
      salt: salt.toString(),
    },
  });
}
