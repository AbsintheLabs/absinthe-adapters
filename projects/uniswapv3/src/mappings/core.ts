import { BigDecimal } from '@subsquid/big-decimal';
import { EvmLog } from '@subsquid/evm-processor/lib/interfaces/evm';
import {
  BlockHandlerContext,
  LogHandlerContext,
  BlockHeader,
} from '../utils/interfaces/interfaces';
import { DataHandlerContext, assertNotNull } from '@subsquid/evm-processor';

import { Store } from '@subsquid/typeorm-store';
import { Multicall } from '../abi/multicall';
import * as poolAbi from '../abi/pool';
import { Bundle, Factory, Pool, Tick, Token, HistoryWindow } from '../model';
import { safeDiv } from '../utils';
import { BlockMap } from '../utils/blockMap';
import {
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
  WETH_ADDRESS,
  USDC_WETH_03_POOL,
  MINIMUM_ETH_LOCKED,
  WHITELIST_TOKENS,
  FACTORY_ADDRESS,
  POSITIONS_ADDRESS,
} from '../utils/constants';
import { EntityManager } from '../utils/entityManager';
import { getTrackedAmountUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing';
import { createTick, feeTierToTickSpacing } from '../utils/tick';
import { last } from '../utils/tools';
import { BlockData } from '@subsquid/evm-processor/src/interfaces/data';
import { Currency, HOURS_TO_MS, MessageType, processValueChangeUniswapV3 } from '@absinthe/common';
type EventData =
  | (InitializeData & { type: 'Initialize' })
  | (MintData & { type: 'Mint' })
  | (BurnData & { type: 'Burn' })
  | (SwapData & { type: 'Swap' });

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

const WINDOW_DURATION_MS = 1 * HOURS_TO_MS;

export async function processPairs(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
): Promise<void> {
  let eventsData = await processItems(ctx, blocks);
  if (!eventsData || eventsData.size == 0) return;

  await prefetch(ctx, eventsData);

  for (let [block, blockEventsData] of eventsData) {
    for (let data of blockEventsData) {
      switch (data.type) {
        case 'Initialize':
          await processInitializeData(ctx, block, data);
          break;
        case 'Mint':
          await processMintData(ctx, block, data);
          break;
        case 'Burn':
          await processBurnData(ctx, block, data);
          break;
        case 'Swap':
          await processSwapData(ctx, block, data);
          break;
      }
    }
  }

  await Promise.all([
    updatePoolFeeVars({ ...ctx, block: last(blocks).header }, ctx.entities.values(Pool)),
    updateTickFeeVars({ ...ctx, block: last(blocks).header }, ctx.entities.values(Tick)),
  ]);
}

async function prefetch(ctx: ContextWithEntityManager, eventsData: BlockMap<EventData>) {
  for (let [, blockEventsData] of eventsData) {
    for (let data of blockEventsData) {
      switch (data.type) {
        case 'Initialize':
          ctx.entities.defer(Tick, tickId(data.poolId, data.tick));
          ctx.entities.defer(Pool, data.poolId);
          break;
        case 'Mint':
          ctx.entities.defer(Pool, data.poolId);
          ctx.entities.defer(
            Tick,
            tickId(data.poolId, data.tickLower),
            tickId(data.poolId, data.tickUpper),
          );
          break;
        case 'Burn':
          ctx.entities.defer(Pool, data.poolId);
          ctx.entities.defer(
            Tick,
            tickId(data.poolId, data.tickLower),
            tickId(data.poolId, data.tickUpper),
          );
          break;
        case 'Swap':
          ctx.entities.defer(Tick, tickId(data.poolId, data.tick));
          ctx.entities.defer(Pool, data.poolId);
          break;
      }
    }
  }

  let pools = await ctx.entities.load(Pool);

  let poolsTicksIds = collectTicksFromPools(pools.values());
  let ticks = await ctx.entities.defer(Tick, ...poolsTicksIds).load(Tick);

  let tokenIds = collectTokensFromPools(pools.values());
  let tokens = await ctx.entities.defer(Token, ...tokenIds).load(Token);

  let whiteListPoolsIds = collectWhiteListPoolsFromTokens(tokens.values());
  pools = await ctx.entities.defer(Pool, ...whiteListPoolsIds).load(Pool);

  let whiteListPoolsTokenIds = collectTokensFromPools(pools.values());
  tokens = await ctx.entities.defer(Token, ...whiteListPoolsTokenIds).load(Token);

  await ctx.entities.load(Pool);
  await ctx.entities.load(Token);
  await ctx.entities.load(Tick);
}

async function processItems(ctx: ContextWithEntityManager, blocks: BlockData[]) {
  let eventsData = new BlockMap<EventData>();

  for (let block of blocks) {
    for (let log of block.logs) {
      let evmLog = {
        logIndex: log.logIndex,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transaction?.hash || '',
        address: log.address,
        data: log.data,
        topics: log.topics,
      };
      let pool = await ctx.entities.get(Pool, log.address);
      if (pool) {
        switch (log.topics[0]) {
          case poolAbi.events.Initialize.topic: {
            let data = processInitialize(evmLog);
            eventsData.push(block.header, {
              type: 'Initialize',
              ...data,
            });
            break;
          }
          case poolAbi.events.Mint.topic: {
            if (log.transaction != undefined) {
              let data = processMint(evmLog, log.transaction);
              eventsData.push(block.header, {
                type: 'Mint',
                ...data,
              });
            }
            break;
          }
          case poolAbi.events.Burn.topic: {
            let data = processBurn(evmLog, log.transaction);
            eventsData.push(block.header, {
              type: 'Burn',
              ...data,
            });
            break;
          }
          case poolAbi.events.Swap.topic: {
            let data = processSwap(evmLog, log.transaction);
            eventsData.push(block.header, {
              type: 'Swap',
              ...data,
            });
            break;
          }
        }
      }
    }
  }
  return eventsData;
}

async function processInitializeData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: InitializeData,
) {
  let bundle = await ctx.entities.getOrFail(Bundle, '1');

  let pool = ctx.entities.get(Pool, data.poolId, false);
  if (pool == null) return;

  let token0 = await ctx.entities.getOrFail(Token, pool.token0Id);
  let token1 = await ctx.entities.getOrFail(Token, pool.token1Id);

  // update pool sqrt price and tick
  pool.sqrtPrice = data.sqrtPrice;
  pool.tick = data.tick;

  // Calculate and update token prices from sqrtPrice
  let prices = sqrtPriceX96ToTokenPrices(
    data.sqrtPrice,
    token0.decimals,
    token1.decimals,
    data.poolId,
  );
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];

  // update token prices
  token0.derivedETH = await getEthPerToken(ctx, token0.id);
  token1.derivedETH = await getEthPerToken(ctx, token1.id);

  let usdcPool = await ctx.entities.get(Pool, USDC_WETH_03_POOL);
  bundle.ethPriceUSD = usdcPool?.token0Price || 0;

  //todo: do we need the twb logic ?
}

async function processMintData(ctx: ContextWithEntityManager, block: BlockHeader, data: MintData) {
  let bundle = await ctx.entities.getOrFail(Bundle, '1');
  let factory = await ctx.entities.getOrFail(Factory, FACTORY_ADDRESS);

  let pool = ctx.entities.get(Pool, data.poolId, false);
  if (pool == null) return;

  const token0 = await ctx.entities.getOrFail(Token, pool.token0Id);
  const token1 = await ctx.entities.getOrFail(Token, pool.token1Id);

  const amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  const amountMintedETH = amount0 * token0.derivedETH + amount1 * token1.derivedETH;
  const amountMintedUSD = amountMintedETH * bundle.ethPriceUSD;

  //todo: do we need this ? - organize this better
  // reset tvl aggregates until new amounts calculated
  factory.totalValueLockedETH = factory.totalValueLockedETH - pool.totalValueLockedETH;

  // update globals
  factory.txCount++;

  // update token0 data
  token0.txCount++;
  token0.totalValueLocked = token0.totalValueLocked + amount0;
  token0.totalValueLockedUSD = token0.totalValueLocked * (token0.derivedETH * bundle.ethPriceUSD);

  // update token1 data
  token1.txCount++;
  token1.totalValueLocked = token1.totalValueLocked + amount1;
  token1.totalValueLockedUSD = token1.totalValueLocked * (token1.derivedETH * bundle.ethPriceUSD);

  // pool data
  pool.txCount++;

  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on mint if the new position includes the current tick.
  if (pool.tick != null && data.tickLower <= pool.tick && data.tickUpper > pool.tick) {
    //todo: discuss positionId
    pool.liquidity += data.amount;
    const newHistoryWindows = processValueChangeUniswapV3({
      from: data.sender,
      to: data.owner,
      amount: data.amount,
      usdValue: amountMintedUSD,
      blockTimestamp: block.timestamp,
      blockHeight: block.height,
      txHash: data.transaction.hash,
      activeBalances: new Map(), //todo: do this
      windowDurationMs: WINDOW_DURATION_MS,
      tickUpper: data.tickUpper,
      tickLower: data.tickLower,
      currentTick: pool.tick,
      poolId: pool.id,
    });
    // pool.balanceWindows.push(...newHistoryWindows);
  }

  //todo: remove this repetition
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0;
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1;
  pool.totalValueLockedETH =
    pool.totalValueLockedToken0 * token0.derivedETH +
    pool.totalValueLockedToken1 * token1.derivedETH;
  pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD;

  // reset aggregates with new amounts
  factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH;
  factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD;

  token0.totalValueLocked = token0.totalValueLocked + amount0;
  token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD;

  token1.totalValueLocked = token1.totalValueLocked + amount1;
  token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD;

  // todo: decide- whether we need this or not
  let lowerTickId = tickId(pool.id, data.tickLower);
  let lowerTick = ctx.entities.get(Tick, lowerTickId, false);
  if (lowerTick == null) {
    lowerTick = createTick(lowerTickId, data.tickLower, pool.id);
    lowerTick.createdAtBlockNumber = block.height;
    lowerTick.createdAtTimestamp = new Date(block.timestamp);
    ctx.entities.add(lowerTick);
  }

  let upperTickId = tickId(pool.id, data.tickUpper);
  let upperTick = ctx.entities.get(Tick, upperTickId, false);
  if (upperTick == null) {
    upperTick = createTick(upperTickId, data.tickUpper, pool.id);
    upperTick.createdAtBlockNumber = block.height;
    upperTick.createdAtTimestamp = new Date(block.timestamp);
    ctx.entities.add(upperTick);
  }

  lowerTick.liquidityGross += data.amount;
  lowerTick.liquidityNet += data.amount;

  upperTick.liquidityGross += data.amount;
  upperTick.liquidityNet -= data.amount;
}

async function processBurnData(ctx: ContextWithEntityManager, block: BlockHeader, data: BurnData) {
  let bundle = await ctx.entities.getOrFail(Bundle, '1');
  let factory = await ctx.entities.getOrFail(Factory, FACTORY_ADDRESS);

  let pool = ctx.entities.get(Pool, data.poolId, false);
  if (pool == null) return;

  let token0 = await ctx.entities.getOrFail(Token, pool.token0Id);
  let token1 = await ctx.entities.getOrFail(Token, pool.token1Id);

  let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  let amountBurnedUSD =
    amount0 * (token0.derivedETH * bundle.ethPriceUSD) +
    amount1 * (token1.derivedETH * bundle.ethPriceUSD);

  // reset tvl aggregates until new amounts calculated
  factory.totalValueLockedETH = factory.totalValueLockedETH - pool.totalValueLockedETH;

  // update globals
  factory.txCount++;

  // update token0 data
  token0.txCount++;
  token0.totalValueLocked = token0.totalValueLocked - amount0;
  token0.totalValueLockedUSD = token0.totalValueLocked * (token0.derivedETH * bundle.ethPriceUSD);

  // update token1 data
  token1.txCount++;
  token1.totalValueLocked = token1.totalValueLocked - amount1;
  token1.totalValueLockedUSD = token1.totalValueLocked * (token1.derivedETH * bundle.ethPriceUSD);

  // pool data
  pool.txCount++;
  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on burn if the position being burnt includes the current tick.
  if (pool.tick != null && data.tickLower <= pool.tick && data.tickUpper > pool.tick) {
    pool.liquidity -= data.amount;
    const newHistoryWindows = processValueChangeUniswapV3({
      from: POSITIONS_ADDRESS,
      to: data.owner,
      amount: BigInt(-data.amount),
      usdValue: amountBurnedUSD,
      blockTimestamp: block.timestamp,
      blockHeight: block.height,
      txHash: data.transaction.hash,
      activeBalances: new Map(), //todo: do this
      windowDurationMs: WINDOW_DURATION_MS,
      tickUpper: data.tickUpper,
      tickLower: data.tickLower,
      currentTick: pool.tick,
      poolId: pool.id,
    });
    for (const window of newHistoryWindows) {
      // ctx.entities.add(new HistoryWindow(window));
    }
  }

  pool.totalValueLockedToken0 = pool.totalValueLockedToken0 - amount0;
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1 - amount1;

  // Update TVL in ETH and USD
  pool.totalValueLockedETH =
    pool.totalValueLockedToken0 * token0.derivedETH +
    pool.totalValueLockedToken1 * token1.derivedETH;
  pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD;

  // Update factory TVL
  factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH;
  factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD;

  // Update token TVL
  token0.totalValueLocked = token0.totalValueLocked - amount0;
  token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD;

  token1.totalValueLocked = token1.totalValueLocked - amount1;
  token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD;

  // tick ctx.entities
  let lowerTickId = tickId(pool.id, data.tickLower);
  let lowerTick = await ctx.entities.get(Tick, lowerTickId);

  let upperTickId = tickId(pool.id, data.tickUpper);
  let upperTick = await ctx.entities.get(Tick, upperTickId);

  if (lowerTick) {
    lowerTick.liquidityGross -= data.amount;
    lowerTick.liquidityNet -= data.amount;
  }

  if (upperTick) {
    upperTick.liquidityGross -= data.amount;
    upperTick.liquidityNet += data.amount;
  }
}

//todo: clean this
async function processSwapData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: SwapData,
): Promise<void> {
  // if (data.poolId == '0x9663f2ca0454accad3e094448ea6f77443880454') return;

  const bundle = await ctx.entities.getOrFail(Bundle, '1');
  const factory = await ctx.entities.getOrFail(Factory, FACTORY_ADDRESS);

  const pool = ctx.entities.get(Pool, data.poolId, false);
  if (pool == null) return;

  const token0 = await ctx.entities.getOrFail(Token, pool.token0Id);
  const token1 = await ctx.entities.getOrFail(Token, pool.token1Id);

  const amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  // need absolute amounts for volume
  const amount0Abs = Math.abs(amount0);
  const amount1Abs = Math.abs(amount1);

  const amount0ETH = amount0Abs * token0.derivedETH;
  const amount1ETH = amount1Abs * token1.derivedETH;

  const amount0USD = amount0ETH * bundle.ethPriceUSD;
  const amount1USD = amount1ETH * bundle.ethPriceUSD;

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  const amountTotalUSDTracked = getTrackedAmountUSD(token0.id, amount0USD, token1.id, amount1USD);

  const amountTotalETHTracked = safeDiv(amountTotalUSDTracked, bundle.ethPriceUSD);
  const amountTotalUSDUntracked = (amount0USD + amount1USD) / 2;

  let feesETH = (Number(amountTotalETHTracked) * Number(pool.feeTier)) / 1000000;
  let feesUSD = (Number(amountTotalUSDTracked) * Number(pool.feeTier)) / 1000000;

  // global updates
  factory.txCount++;
  factory.totalVolumeETH = factory.totalVolumeETH + amountTotalETHTracked;
  factory.totalVolumeUSD = factory.totalVolumeUSD + amountTotalUSDTracked;
  factory.untrackedVolumeUSD = factory.untrackedVolumeUSD + amountTotalUSDUntracked;
  factory.totalFeesETH = factory.totalFeesETH + feesETH;
  factory.totalFeesUSD = factory.totalFeesUSD + feesUSD;

  // reset aggregate tvl before individual pool tvl updates
  let currentPoolTvlETH = pool.totalValueLockedETH;
  factory.totalValueLockedETH = factory.totalValueLockedETH - currentPoolTvlETH;

  // pool volume
  pool.txCount++;
  pool.volumeToken0 = pool.volumeToken0 + amount0Abs;
  pool.volumeToken1 = pool.volumeToken1 + amount1Abs;
  pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked;
  pool.untrackedVolumeUSD = pool.untrackedVolumeUSD + amountTotalUSDUntracked;
  pool.feesUSD = pool.feesUSD + feesUSD;

  // Update the pool with the new active liquidity, price, and tick.
  pool.liquidity = data.liquidity;
  pool.tick = data.tick;
  pool.sqrtPrice = data.sqrtPrice;
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0;
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1;

  // update token0 data
  token0.txCount++;
  token0.volume = token0.volume + amount0Abs;
  token0.totalValueLocked = token0.totalValueLocked + amount0;
  token0.volumeUSD = token0.volumeUSD + amountTotalUSDTracked;
  token0.untrackedVolumeUSD = token0.untrackedVolumeUSD + amountTotalUSDUntracked;
  token0.feesUSD = token0.feesUSD + feesUSD;

  // update token1 data
  token1.txCount++;
  token1.volume = token1.volume + amount1Abs;
  token1.totalValueLocked = token1.totalValueLocked + amount1;
  token1.volumeUSD = token1.volumeUSD + amountTotalUSDTracked;
  token1.untrackedVolumeUSD = token1.untrackedVolumeUSD + amountTotalUSDUntracked;
  token1.feesUSD = token1.feesUSD + feesUSD;

  // updated pool ratess
  const prices = sqrtPriceX96ToTokenPrices(
    pool.sqrtPrice,
    token0.decimals,
    token1.decimals,
    pool.id,
  );
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];

  // update USD pricing
  token0.derivedETH = await getEthPerToken(ctx, token0.id);
  token1.derivedETH = await getEthPerToken(ctx, token1.id);

  let usdcPool = await ctx.entities.get(Pool, USDC_WETH_03_POOL);
  bundle.ethPriceUSD = usdcPool?.token0Price || 0;

  // Things afffected by new USD rates
  pool.totalValueLockedETH =
    pool.totalValueLockedToken0 * token0.derivedETH +
    pool.totalValueLockedToken1 * token1.derivedETH;
  pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD;

  // Update factory TVL
  factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH;
  factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD;

  token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD;
  token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD;

  const swappedAmountETH = amount0Abs * token0.derivedETH + amount1Abs * token1.derivedETH;
  const swappedAmountUSD = swappedAmountETH * bundle.ethPriceUSD;

  const newTick = pool.tick;
  const tickSpacing = feeTierToTickSpacing(pool.feeTier);
  const modulo = Math.floor(Number(newTick) / Number(tickSpacing));
  if (modulo == 0) {
    let tick = createTick(tickId(pool.id, newTick), newTick, pool.id);
    tick.createdAtBlockNumber = block.height;
    tick.createdAtTimestamp = new Date(block.timestamp);
    ctx.entities.add(tick);
  }

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    tokens: JSON.stringify([
      {
        token: {
          decimals: token0.decimals,
          address: token0.id,
          symbol: token0.symbol,
        },
        amount: amount0.toString(),
      },
      {
        token: {
          decimals: token1.decimals,
          address: token1.id,
          symbol: token1.symbol,
        },
        amount: amount1.toString(),
      },
      {
        liquidity: pool.liquidity.toString(),
        sqrtPrice: pool.sqrtPrice.toString(),
        tick: pool.tick.toString(),
      },
    ]),
    rawAmount: swappedAmountETH.toString(), //todo: decimal adjusted
    displayAmount: swappedAmountETH,
    unixTimestampMs: block.timestamp,
    txHash: data.transaction.hash,
    logIndex: data.logIndex,
    blockNumber: block.height,
    blockHash: block.hash,
    userId: data.sender,
    currency: Currency.USD,
    valueUsd: swappedAmountUSD,
    gasUsed: Number(data.transaction.gas),
    gasFeeUsd: Number(data.transaction.gasPrice) * Number(data.transaction.gas),
  };
  // pool.transactions.push(transactionSchema);

  //todo:
  // we want to find all positions that are no longer within range, we want to no longer actively flush them.
  // we want to find positions that are now within range and start tracking them as active from that moment on.
}

//todo: improve this.
async function getEthPerToken(ctx: ContextWithEntityManager, tokenId: string): Promise<number> {
  let bundle = await ctx.entities.getOrFail(Bundle, '1');
  let token = await ctx.entities.getOrFail(Token, tokenId);

  // Return 1 for WETH
  if (tokenId.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    return 1;
  }

  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityETH = MINIMUM_ETH_LOCKED;
  let priceSoFar = 0;
  let selectedPoolAddress = '';

  // Use WHITELIST_TOKENS instead of STABLE_COINS for consistency
  if (WHITELIST_TOKENS.includes(tokenId.toLowerCase())) {
    priceSoFar = safeDiv(1, bundle.ethPriceUSD);
  } else {
    for (let poolAddress of token.whitelistPools) {
      let pool = await ctx.entities.getOrFail(Pool, poolAddress);
      if (pool.liquidity === 0n) continue;

      if (pool.token0Id.toLowerCase() === tokenId.toLowerCase()) {
        // whitelist token is token1
        let token1 = await ctx.entities.getOrFail(Token, pool.token1Id);
        // Skip if token1's price is not derived yet
        if (token1.derivedETH === 0) continue;

        // get the derived ETH in pool
        let ethLocked = pool.totalValueLockedToken1 * token1.derivedETH;
        if (ethLocked > largestLiquidityETH && ethLocked >= MINIMUM_ETH_LOCKED) {
          largestLiquidityETH = ethLocked;
          // token1 per our token * Eth per token1
          priceSoFar = pool.token1Price * token1.derivedETH;
          selectedPoolAddress = poolAddress;
        }
      }
      if (pool.token1Id.toLowerCase() === tokenId.toLowerCase()) {
        // whitelist token is token0
        let token0 = await ctx.entities.getOrFail(Token, pool.token0Id);
        // Skip if token0's price is not derived yet
        if (token0.derivedETH === 0) continue;

        // get the derived ETH in pool
        let ethLocked = pool.totalValueLockedToken0 * token0.derivedETH;
        if (ethLocked > largestLiquidityETH && ethLocked >= MINIMUM_ETH_LOCKED) {
          largestLiquidityETH = ethLocked;
          // token0 per our token * ETH per token0
          priceSoFar = pool.token0Price * token0.derivedETH;
          selectedPoolAddress = poolAddress;
        }
      }
    }
  }
  return priceSoFar;
}

function collectTokensFromPools(pools: Iterable<Pool>) {
  let ids = new Set<string>();
  for (let pool of pools) {
    ids.add(pool.token0Id);
    ids.add(pool.token1Id);
  }
  return ids;
}

function collectTicksFromPools(pools: Iterable<Pool>) {
  let ids = new Set<string>();
  for (let pool of pools) {
    ids.add(tickId(pool.id, pool.tick ?? 0));
  }
  return ids;
}

function collectWhiteListPoolsFromTokens(tokens: Iterable<Token>) {
  let ids = new Set<string>();
  for (let token of tokens) {
    token.whitelistPools.forEach((id) => ids.add(id));
  }
  return ids;
}

interface InitializeData {
  poolId: string;
  tick: number;
  sqrtPrice: bigint;
}

function processInitialize(log: EvmLog): InitializeData {
  let { tick, sqrtPriceX96 } = poolAbi.events.Initialize.decode(log);
  return {
    poolId: log.address,
    tick: tick,
    sqrtPrice: sqrtPriceX96,
  };
}

interface MintData {
  transaction: { hash: string; gasPrice: bigint; from: string; gas: bigint };
  poolId: string;
  amount0: bigint;
  amount1: bigint;
  amount: bigint;
  tickLower: number;
  tickUpper: number;
  sender: string;
  owner: string;
  logIndex: number;
}

function processMint(log: EvmLog, transaction: any): MintData {
  let { amount0, amount1, amount, tickLower, tickUpper, sender, owner } =
    poolAbi.events.Mint.decode(log);

  //todo: note - liquidity amount added by me (In abstract liquidity value)
  return {
    transaction: {
      hash: transaction.hash,
      gasPrice: transaction.gasPrice,
      from: transaction.from,
      gas: BigInt(transaction.gasUsed || 0),
    },
    poolId: log.address,
    amount0: amount0,
    amount1: amount1,
    amount: amount,
    tickLower: tickLower,
    tickUpper: tickUpper,
    sender: sender,
    owner: owner,
    logIndex: log.logIndex,
  };
}

interface BurnData {
  transaction: { hash: string; gasPrice: bigint; from: string; gas: bigint };
  poolId: string;
  amount0: bigint;
  amount1: bigint;
  amount: bigint;
  tickLower: number;
  tickUpper: number;
  owner: string;
  logIndex: number;
}

function processBurn(log: EvmLog, transaction: any): BurnData {
  let event = poolAbi.events.Burn.decode(log);
  return {
    transaction: {
      hash: transaction.hash,
      gasPrice: transaction.gasPrice,
      from: transaction.from,
      gas: BigInt(transaction.gasUsed || 0),
    },
    poolId: log.address,
    amount0: event.amount0,
    amount1: event.amount1,
    amount: event.amount,
    tickLower: event.tickLower,
    tickUpper: event.tickUpper,
    owner: event.owner,
    logIndex: log.logIndex,
  };
}

interface SwapData {
  transaction: { hash: string; gasPrice: bigint; from: string; gas: bigint };
  poolId: string;
  amount0: bigint;
  amount1: bigint;
  tick: number;
  sqrtPrice: bigint;
  sender: string;
  recipient: string;
  liquidity: bigint;
  logIndex: number;
}

function processSwap(log: EvmLog, transaction: any): SwapData {
  let event = poolAbi.events.Swap.decode(log);
  return {
    transaction: {
      hash: transaction.hash,
      gasPrice: transaction.gasPrice,
      from: transaction.from,
      gas: BigInt(transaction.gasUsed || 0),
    },
    poolId: log.address,
    amount0: event.amount0,
    amount1: event.amount1,
    tick: event.tick,
    sqrtPrice: event.sqrtPriceX96,
    sender: event.sender,
    recipient: event.recipient,
    logIndex: log.logIndex,
    liquidity: event.liquidity,
  };
}

export async function handleFlash(ctx: LogHandlerContext<Store>): Promise<void> {
  // update fee growth
  let pool = await ctx.store.get(Pool, ctx.evmLog.address).then(assertNotNull);
  let poolContract = new poolAbi.Contract(ctx, ctx.evmLog.address);
  let feeGrowthGlobal0X128 = await poolContract.feeGrowthGlobal0X128();
  let feeGrowthGlobal1X128 = await poolContract.feeGrowthGlobal1X128();
  pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128;
  pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128;
  await ctx.store.save(pool);
}

async function updateTickFeeVars(ctx: BlockHandlerContext<Store>, ticks: Tick[]): Promise<void> {
  // not all ticks are initialized so obtaining null is expected behavior
  let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const tickResult = await multicall.aggregate(
    poolAbi.functions.ticks,
    ticks.map<[string, { tick: bigint }]>((t) => {
      return [
        t.poolId,
        {
          tick: t.tickIdx,
        },
      ];
    }),
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < ticks.length; i++) {
    ticks[i].feeGrowthOutside0X128 = tickResult[i].feeGrowthOutside0X128;
    ticks[i].feeGrowthOutside1X128 = tickResult[i].feeGrowthOutside1X128;
  }
}

async function updatePoolFeeVars(ctx: BlockHandlerContext<Store>, pools: Pool[]): Promise<void> {
  let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const calls: [string, {}][] = pools.map((p) => {
    return [p.id, {}];
  });
  let fee0 = await multicall.aggregate(
    poolAbi.functions.feeGrowthGlobal0X128,
    calls,
    MULTICALL_PAGE_SIZE,
  );
  let fee1 = await multicall.aggregate(
    poolAbi.functions.feeGrowthGlobal1X128,
    calls,
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < pools.length; i++) {
    pools[i].feeGrowthGlobal0X128 = fee0[i];
    pools[i].feeGrowthGlobal1X128 = fee1[i];
  }
}

function tickId(poolId: string, tickIdx: number) {
  return `${poolId}#${tickIdx}`;
}
