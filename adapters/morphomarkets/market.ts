import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import * as morphov1Abi from './abi/morphov1.ts';
import { Redis } from 'ioredis';
import { SCALE } from './consts.ts';
import { logger } from '../../src/utils/logger.ts';

function deriveIndexFromEvent(assets: bigint, shares: bigint): bigint {
  if (shares === 0n) return SCALE;
  return (assets * SCALE) / shares;
}

export async function handleMarket(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  morphoBlueAddress: string,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const configuredMarketId = (instance as any).assetSelectors?.marketId?.toLowerCase();

  if (!configuredMarketId) {
    console.warn(`No marketId specified in assetSelectors for ${morphoBlueAddress}`);
    return;
  }

  // Route to appropriate handler based on event type
  if (log.topic0 === morphov1Abi.events.Supply.topic) {
    await handleSupply(log, emitFns, instance, configuredMarketId, redis);
  } else if (log.topic0 === morphov1Abi.events.Withdraw.topic) {
    await handleWithdraw(log, emitFns, instance, configuredMarketId, redis);
  } else if (log.topic0 === morphov1Abi.events.Borrow.topic) {
    await handleBorrow(log, emitFns, instance, configuredMarketId, redis);
  } else if (log.topic0 === morphov1Abi.events.Repay.topic) {
    await handleRepay(log, emitFns, instance, configuredMarketId, redis);
  } else {
    logger.warn('UNKNOWN EVENT TYPE:', log.topic0);
  }
  await emitFns.position.reprice({ trackableInstance: instance });
}

async function handleSupply(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  configuredMarketId: string,
  redis: Redis,
): Promise<void> {
  const {
    id: marketId,
    onBehalf,
    assets,
    shares,
  } = morphov1Abi.events.Supply.decode({
    topics: log.topics,
    data: log.data,
  });

  // Filter by configured market
  if (marketId.toLowerCase() !== configuredMarketId) {
    return;
  }

  // Get market data from Redis
  const marketDataKey = `morpho:market:${marketId.toLowerCase()}`;
  const marketDataStr = await redis.get(marketDataKey);

  if (!marketDataStr) {
    console.warn(`Market data not found for ${marketId}`);
    return;
  }

  const marketData = JSON.parse(marketDataStr);

  // Derive and store supply index
  const supplyIndex = deriveIndexFromEvent(BigInt(assets), BigInt(shares));
  marketData.supplyIndex = supplyIndex.toString();
  await redis.set(marketDataKey, JSON.stringify(marketData));

  await emitFns.position.balanceDelta({
    user: onBehalf.toLowerCase(),
    asset: { type: 'custom', prefix: 'morpho', key: `${marketId.toLowerCase()}-supply` },
    amount: BigInt(shares),
    activity: 'hold',
    trackableInstance: instance,
    meta: {
      marketId: marketId.toLowerCase(),
      shares: shares.toString(),
      supplyIndex: supplyIndex.toString(),
      positionSide: 'supply',
    },
  });

  // always reprice after an event
}

async function handleWithdraw(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  configuredMarketId: string,
  redis: Redis,
): Promise<void> {
  const {
    id: marketId,
    onBehalf,
    assets,
    shares,
  } = morphov1Abi.events.Withdraw.decode({
    topics: log.topics,
    data: log.data,
  });

  if (marketId.toLowerCase() !== configuredMarketId) {
    return;
  }

  const marketDataKey = `morpho:market:${marketId.toLowerCase()}`;
  const marketDataStr = await redis.get(marketDataKey);

  if (!marketDataStr) {
    console.warn(`Market data not found for ${marketId}`);
    return;
  }

  const marketData = JSON.parse(marketDataStr);

  const supplyIndex = deriveIndexFromEvent(BigInt(assets), BigInt(shares));
  marketData.supplyIndex = supplyIndex.toString();
  await redis.set(marketDataKey, JSON.stringify(marketData));

  await emitFns.position.balanceDelta({
    activity: 'hold',
    user: onBehalf.toLowerCase(),
    asset: { type: 'custom', prefix: 'morpho', key: `${marketId.toLowerCase()}-supply` },
    amount: -BigInt(shares),
    trackableInstance: instance,
    meta: {
      marketId: marketId.toLowerCase(),
      shares: shares.toString(),
      supplyIndex: supplyIndex.toString(),
      positionSide: 'withdraw',
    },
  });
}

async function handleBorrow(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  configuredMarketId: string,
  redis: Redis,
): Promise<void> {
  const {
    id: marketId,
    onBehalf,
    assets,
    shares,
  } = morphov1Abi.events.Borrow.decode({
    topics: log.topics,
    data: log.data,
  });

  if (marketId.toLowerCase() !== configuredMarketId) {
    return;
  }

  logger.debug('onBehalf', onBehalf, log.height, 'borrow');

  const marketDataKey = `morpho:market:${marketId.toLowerCase()}`;
  const marketDataStr = await redis.get(marketDataKey);

  if (!marketDataStr) {
    console.warn(`Market data not found for ${marketId}`);
    return;
  }

  const marketData = JSON.parse(marketDataStr);

  const borrowIndex = deriveIndexFromEvent(BigInt(assets), BigInt(shares));
  marketData.borrowIndex = borrowIndex.toString();
  await redis.set(marketDataKey, JSON.stringify(marketData));

  await emitFns.position.balanceDelta({
    activity: 'hold',
    user: onBehalf.toLowerCase(),
    asset: { type: 'custom', prefix: 'morpho', key: `${marketId.toLowerCase()}-borrow` },
    amount: BigInt(shares),
    trackableInstance: instance,
    meta: {
      marketId: marketId.toLowerCase(),
      shares: shares.toString(),
      borrowIndex: borrowIndex.toString(),
      positionSide: 'borrow',
    },
  });
}

async function handleRepay(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.morphoblue>,
  configuredMarketId: string,
  redis: Redis,
): Promise<void> {
  const {
    id: marketId,
    onBehalf,
    assets,
    shares,
  } = morphov1Abi.events.Repay.decode({
    topics: log.topics,
    data: log.data,
  });

  // if (onBehalf.toLowerCase() === '0xcf01ceaf894a7025b241dd58cf4366b814af9f8'.toLowerCase()) {
  //   return;
  // }

  if (marketId.toLowerCase() !== configuredMarketId) {
    return;
  }

  const marketDataKey = `morpho:market:${marketId.toLowerCase()}`;
  const marketDataStr = await redis.get(marketDataKey);

  if (!marketDataStr) {
    console.warn(`Market data not found for ${marketId}`);
    return;
  }

  const marketData = JSON.parse(marketDataStr);

  const borrowIndex = deriveIndexFromEvent(BigInt(assets), BigInt(shares));
  marketData.borrowIndex = borrowIndex.toString();
  await redis.set(marketDataKey, JSON.stringify(marketData));

  await emitFns.position.balanceDelta({
    activity: 'hold',
    user: onBehalf.toLowerCase(),
    asset: { type: 'custom', prefix: 'morpho', key: `${marketId.toLowerCase()}-borrow` },
    amount: -BigInt(shares),
    trackableInstance: instance,
    meta: {
      marketId: marketId.toLowerCase(),
      shares: shares.toString(),
      borrowIndex: borrowIndex.toString(),
      positionSide: 'repay',
    },
  });
}
