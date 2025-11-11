// Bid handler for GBM Auctions Legacy
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import * as morphov1MarketsAbi from './abi/morphov1.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { Redis } from 'ioredis';
import * as erc20Abi from '../../src/abi/erc20.ts';
import { SCALE } from './consts.ts';

export async function handleCreateMetaMorphoFactory(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  marketIds: Set<string>,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const decoded = morphov1MarketsAbi.events.CreateMarket.decode({
    topics: log.topics,
    data: log.data,
  });

  const { id, marketParams } = decoded;

  // Fix: Use proper type access
  const configuredMarketId = (instance as any).assetSelectors?.marketId?.toLowerCase();

  if (!configuredMarketId || id.toLowerCase() !== configuredMarketId) {
    console.warn(`Market does not match: ${id} !== ${configuredMarketId}`);
    return;
  }

  const { loanToken, collateralToken, oracle, irm, lltv } = marketParams;

  const assetContract = new erc20Abi.Contract(sqdRpcCtx, loanToken);
  const decimals = await assetContract.decimals();

  const marketDataKey = `morpho:market:${id.toLowerCase()}`;
  const marketData = {
    loanToken: loanToken.toString(),
    collateralToken: collateralToken.toString(),
    oracle: oracle.toString(),
    irm: irm.toString(),
    lltv: lltv.toString(),
    decimals: decimals,
    supplyIndex: SCALE.toString(),
    borrowIndex: SCALE.toString(),
  };
  await redis.set(marketDataKey, JSON.stringify(marketData));
  console.info(`Market created and stored in Redis: ${id}`, marketData);

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.index}`),
    activity: 'CreateMarket',
    user: log.address.toLowerCase(),
    trackableInstance: instance,
    amount: 0n,
    meta: {
      id: id.toString(),
      loanToken: loanToken.toString(),
      collateralToken: collateralToken.toString(),
      oracle: oracle.toString(),
      irm: irm.toString(),
      lltv: lltv.toString(),
    },
  });
}
