import { metadata } from './metadata.ts';
import { manifest } from './manifest.ts';

// Protocol ABI imports
import * as printrAbi from './abi/printr.ts';
import * as printr2Abi from './abi/printr2.ts';
import * as poolAbi from './abi/pool.ts';
import * as pool2Abi from './abi/pool2.ts';
import * as factoryAbi from './abi/factory.ts';
import * as erc20Abi from './abi/erc20.ts';

// Handler imports
import {
  defineAdapter,
  md5Hash,
  UnifiedEvmLog,
  EmitFunctions,
  SqdRpcCtx,
  InstanceFrom,
} from '../_shared/index.ts';
import { Redis } from 'ioredis';
import ky from 'ky';
import { logger } from '../../src/utils/logger.ts';

// Constants
const LIQUIDITY_FEE = 3000;
const LIQUIDITY_FEE_BSC = 2500;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Chain IDs (for fee determination)
const ChainId = {
  BSC: 56,
  MONAD: 143, // Adjust if needed
} as const;

// Market cap thresholds (in USD)
const MCAP_THRESHOLDS = [250000, 500000, 1000000, 10000000, 100000000, 1000000000];

// MCAP milestone points mapping
// Format: { threshold: { holdersPoints: number, creatorPoints: number } }
const MCAP_MILESTONE_POINTS: Record<number, { holdersPoints: number; creatorPoints: number }> = {
  250000: { holdersPoints: 250000, creatorPoints: 25000 },
  500000: { holdersPoints: 500000, creatorPoints: 50000 },
  1000000: { holdersPoints: 1000000, creatorPoints: 100000 },
  10000000: { holdersPoints: 10000000, creatorPoints: 1000000 },
  100000000: { holdersPoints: 100000000, creatorPoints: 10000000 },
  1000000000: { holdersPoints: 1000000000, creatorPoints: 100000000 },
};

// Helper function to fetch historical USD price from CoinGecko
async function fetchHistoricalUsd(
  coingeckoId: string,
  timestampMs: number,
  apiKey?: string,
): Promise<number> {
  try {
    const d = new Date(timestampMs);
    const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getFullYear()}`;

    const url = `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/history`;
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (apiKey) {
      headers['x-cg-pro-api-key'] = apiKey;
    }

    const r = await ky
      .get(url, {
        searchParams: { date, localization: 'false' },
        headers,
      })
      .json<any>();

    if (r?.market_data?.current_price?.usd) {
      return r.market_data.current_price.usd;
    }

    // Fallback to current price if historical not available
    const currentPriceUrl = `https://pro-api.coingecko.com/api/v3/simple/price`;
    const currentPriceResponse = await ky
      .get(currentPriceUrl, {
        searchParams: { ids: coingeckoId, vs_currencies: 'usd' },
        headers,
      })
      .json<Record<string, { usd?: number }>>();

    const currentPrice = currentPriceResponse[coingeckoId]?.usd;
    if (currentPrice) {
      return currentPrice;
    }

    return 0;
  } catch (error) {
    logger.warn(`Failed to fetch USD price for ${coingeckoId}:`, error);
    return 0;
  }
}

// Helper function to calculate swap value in USD and return other token price
// Flow:
// 1. Calculate swapValueUsd from assetSelector token: assetSelectorTokenAmount * assetSelectorTokenPrice = swapValueUsd
// 2. Derive otherTokenPriceInUsd: swapValueUsd / otherTokenAmount = otherTokenPriceInUsd
// Returns: { swapValueUsd: number, otherTokenPriceInUsd: number }
async function calculateSwapValueUsd(
  amount0: bigint,
  amount1: bigint,
  token0Address: string,
  token1Address: string,
  baseTokenAddress: string,
  assetSelectorTokenAddress: string, // The token selected in assetSelector
  timestampMs: number,
  redis: Redis,
  instance: any, // Trackable instance to get pricing config
): Promise<{ swapValueUsd: number; otherTokenPriceInUsd: number }> {
  // Determine which token is the assetSelector token and which is the other token
  const token0IsAssetSelector =
    token0Address.toLowerCase() === assetSelectorTokenAddress.toLowerCase();
  const token1IsAssetSelector =
    token1Address.toLowerCase() === assetSelectorTokenAddress.toLowerCase();

  if (!token0IsAssetSelector && !token1IsAssetSelector) {
    logger.warn(
      `AssetSelector token ${assetSelectorTokenAddress} doesn't match either token in pool. token0: ${token0Address}, token1: ${token1Address}`,
    );
    throw new Error(
      `AssetSelector token ${assetSelectorTokenAddress} doesn't match either token in pool. token0: ${token0Address}, token1: ${token1Address}`,
    );
  }

  // Get the assetSelector token amount and address
  const assetSelectorTokenAmount = token0IsAssetSelector ? amount0 : amount1;
  const assetSelectorTokenAddress_actual = token0IsAssetSelector ? token0Address : token1Address;
  const assetSelectorTokenAmountAbs =
    assetSelectorTokenAmount < 0n ? -assetSelectorTokenAmount : assetSelectorTokenAmount;

  // Get assetSelector token decimals (cached during LiquidityDeployed)
  const assetSelectorTokenDecimalsKey = `token:${assetSelectorTokenAddress_actual.toLowerCase()}:decimals`;
  const assetSelectorTokenDecimals = await redis.get(assetSelectorTokenDecimalsKey);
  const assetSelectorDecimals = parseInt(assetSelectorTokenDecimals ?? '18', 10);
  const assetSelectorTokenAmountScaled =
    Number(assetSelectorTokenAmountAbs) / Math.pow(10, assetSelectorDecimals);

  // Get CoinGecko ID from instance pricing config (this is for the assetSelector token)
  const pricing = instance.pricing;
  if (!pricing || pricing.kind !== 'coingecko' || !pricing.id) {
    logger.warn(`No CoinGecko pricing config found in instance`);
    return { swapValueUsd: 0, otherTokenPriceInUsd: 0 };
  }

  const coingeckoId = pricing.id;

  // Cache assetSelector token price in Redis (TTL 1 hour)
  const priceCacheKey = `price:${coingeckoId}:${Math.floor(timestampMs / 3600000)}`; // Hourly cache
  let assetSelectorTokenPriceUsd = await redis.get(priceCacheKey);

  if (!assetSelectorTokenPriceUsd) {
    const apiKey = process.env.COINGECKO_API_KEY;
    const price = await fetchHistoricalUsd(coingeckoId, timestampMs, apiKey);
    if (price > 0) {
      assetSelectorTokenPriceUsd = price.toString();
      await redis.set(priceCacheKey, assetSelectorTokenPriceUsd, 'EX', 3600); // Cache for 1 hour
    } else {
      return { swapValueUsd: 0, otherTokenPriceInUsd: 0 };
    }
  }

  // Step 1: Calculate swap value in USD from assetSelector token
  // swapValueUsd = assetSelectorTokenAmount * assetSelectorTokenPrice
  const swapValueUsd = assetSelectorTokenAmountScaled * parseFloat(assetSelectorTokenPriceUsd);

  // Step 2: Get the OTHER token amount to derive its price
  const otherTokenIsToken0 = token1IsAssetSelector; // If token1 is assetSelector, then token0 is the other

  const otherTokenAmount = otherTokenIsToken0 ? amount0 : amount1;
  const otherTokenAddress = otherTokenIsToken0 ? token0Address : token1Address;
  const otherTokenAmountAbs = otherTokenAmount < 0n ? -otherTokenAmount : otherTokenAmount;

  // Get other token decimals
  const otherTokenDecimalsKey = `token:${otherTokenAddress.toLowerCase()}:decimals`;
  const otherTokenDecimals = await redis.get(otherTokenDecimalsKey);
  const otherDecimals = parseInt(otherTokenDecimals ?? '18', 10);
  const otherTokenAmountScaled = Number(otherTokenAmountAbs) / Math.pow(10, otherDecimals);

  // Step 3: Derive other token price in USD
  // otherTokenPriceInUsd = swapValueUsd / otherTokenAmount
  const otherTokenPriceInUsd =
    otherTokenAmountScaled > 0 ? swapValueUsd / otherTokenAmountScaled : 0;

  return { swapValueUsd, otherTokenPriceInUsd };
}

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Collect Printr contract addresses
    const printrContracts = new Set([
      ...(config.tokenTrade?.map((t) => t.params.printrContractAddress) || []),
      ...(config.curveCreated?.map((c) => c.params.printrccContractAddress) || []),
      ...(config.liquidityDeployed?.map((l) => l.params.printrldContractAddress) || []),
    ]);

    const factoryAddress = config.swap?.[0]?.params.factoryAddress || '';
    // Event topics
    const transferTopic = erc20Abi.events.Transfer.topic;
    const tokenTradeTopic = printrAbi.events.TokenTrade.topic;
    const curveCreatedTopic = printrAbi.events.CurveCreated.topic;
    const liquidityDeployedTopic = printrAbi.events.LiquidityDeployed.topic;
    const swapTopicPool = poolAbi.events.Swap.topic;
    const swapTopicPool2 = pool2Abi.events.Swap.topic;

    return {
      buildSqdProcessor: (base) => {
        // Subscribe to Printr protocol events
        if (printrContracts.size > 0) {
          base.addLog({
            address: Array.from(printrContracts),
            topic0: [tokenTradeTopic, curveCreatedTopic, liquidityDeployedTopic],
          });
        }

        // Subscribe to ALL swap events (no address filter)
        // We'll filter by discovered pools in onLog
        // Only listen to swap events from transactions
        if (config.swap && config.swap.length > 0) {
          base.addLog({
            topic0: [swapTopicPool, swapTopicPool2],
            transaction: true,
          });
        }

        // Subscribe to ALL Transfer events (generic ERC-20 listener)
        // This allows dynamic token discovery
        base.addLog({
          topic0: [transferTopic],
        });

        return base;
      },

      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const logAddress = log.address.toLowerCase();

        // Handle Printr protocol events
        if (log.topic0 === tokenTradeTopic) {
          await handleTokenTrade(log, emitFns, config, logAddress, redis);
        } else if (log.topic0 === curveCreatedTopic) {
          await handleCurveCreated(log, emitFns, config, logAddress, redis);
        } else if (log.topic0 === liquidityDeployedTopic) {
          logger.debug(
            `[onLog] Received LiquidityDeployed event from ${logAddress} at block ${log.height}`,
          );
          await handleLiquidityDeployed(
            log,
            emitFns,
            config,
            logAddress,
            sqdRpcCtx,
            redis,
            factoryAddress,
          );
        }

        // Handle pool swap events (check if pool was discovered)
        if (log.topic0 === swapTopicPool || log.topic0 === swapTopicPool2) {
          logger.debug(
            `[onLog] Received Swap event from pool ${logAddress} at block ${log.height}`,
          );
          await handlePoolSwap(log, emitFns, config, logAddress, sqdRpcCtx, redis);
        }

        // Handle generic ERC-20 Transfer events
        if (log.topic0 === transferTopic) {
          await handleTransfer(log, emitFns, config, redis);
        }
      },
    };
  },
});

// Handler for TokenTrade events
async function handleTokenTrade(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  config: any,
  printrContractAddress: string,
  redis: Redis,
): Promise<void> {
  const decoded = printrAbi.events.TokenTrade.decode({
    topics: log.topics,
    data: log.data,
  });

  const { token, trader, isBuy, amount, cost, effectivePrice, mintedSupply, reserve } = decoded;
  const tokenAddress = token.toLowerCase();
  const chainId = log.chainId;

  // Find matching trackable instances
  const instances =
    config.tokenTrade?.filter(
      (t: any) => t.params.printrContractAddress.toLowerCase() === printrContractAddress,
    ) || [];

  // Redis-first: Read existing state
  const tokenStateKey = `printr:token:${chainId}:${tokenAddress}`;
  const existingState = await redis.hgetall(tokenStateKey);

  // Block guard: ignore if block < lastTradeBlock
  const lastTradeBlock = existingState.lastTradeBlock
    ? parseInt(existingState.lastTradeBlock, 10)
    : 0;
  if (log.height < lastTradeBlock) {
    return; // Out of order, skip
  }

  // Store final supply for this token (will be used for market cap calculation)
  // We update it on every trade, but only use the last one before LiquidityDeployed
  const supplyKey = `printr:token:${tokenAddress}:finalSupply`;
  await redis.set(supplyKey, mintedSupply.toString());

  // Update Redis HASH with new state
  // Note: priceUsd and mcapUsd will be calculated from swap events after graduation
  // For now, we store the bonding curve effective price
  await redis.hset(tokenStateKey, {
    mintedSupply: mintedSupply.toString(),
    priceUsd: '0', // Will be updated from swap events
    mcapUsd: '0', // Will be updated from swap events
    lastTradeBlock: log.height.toString(),
    lastTradeTs: log.tsMs.toString(),
  });

  // Emit action for each matching instance
  for (const instance of instances) {
    await emitFns.action.action({
      key: md5Hash(`${log.txRef}${log.index}`),
      user: trader.toLowerCase(),
      asset: { type: 'erc20', address: tokenAddress },
      amount: BigInt(amount),
      activity: isBuy ? 'buy' : 'sell',
      trackableInstance: instance,
      meta: {
        cost: cost.toString(),
        effectivePrice: effectivePrice.toString(),
        mintedSupply: mintedSupply.toString(),
        reserve: reserve.toString(),
        isBuy: isBuy.toString(),
      },
    });
  }
}

// Handler for CurveCreated events
async function handleCurveCreated(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  config: any,
  printrContractAddress: string,
  redis: Redis,
): Promise<void> {
  const decoded = printrAbi.events.CurveCreated.decode({
    topics: log.topics,
    data: log.data,
  });

  const { creator, token, tokenId } = decoded;
  const tokenAddress = token.toLowerCase();
  const chainId = log.chainId;

  // Initialize token state in Redis (Redis-first plan)
  const tokenStateKey = `printr:token:${chainId}:${tokenAddress}`;
  await redis.hset(tokenStateKey, {
    creator: creator.toLowerCase(),
    mintedSupply: '0',
    priceUsd: '0',
    mcapUsd: '0',
    lastTradeBlock: '0',
    lastTradeTs: '0',
  });

  const instances =
    config.curveCreated?.filter(
      (c: any) => c.params.printrccContractAddress?.toLowerCase() === printrContractAddress,
    ) || [];

  for (const instance of instances) {
    await emitFns.action.action({
      key: md5Hash(`${log.txRef}${log.index}`),
      user: creator.toLowerCase(),
      activity: 'curveCreated',
      trackableInstance: instance,
      amount: 0n,
      meta: {
        token: tokenAddress,
        tokenId: tokenId,
      },
    });
  }
}

// Handler for LiquidityDeployed events (token graduation)
async function handleLiquidityDeployed(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  config: any,
  printrContractAddress: string,
  sqdRpcCtx: SqdRpcCtx,
  redis: Redis,
  factoryAddress: string,
): Promise<void> {
  const decoded = printrAbi.events.LiquidityDeployed.decode({
    topics: log.topics,
    data: log.data,
  });

  const { token, tokenAmount, baseAmount } = decoded;
  const tokenAddress = token.toLowerCase();
  const chainId = log.chainId;

  // Get final supply from last TokenTrade before this event
  const supplyKey = `printr:token:${tokenAddress}:finalSupply`;
  const finalSupplyStr = await redis.get(supplyKey);
  const finalSupply = finalSupplyStr ? BigInt(finalSupplyStr) : null;

  try {
    // Get base token from Printr contract
    const printr2Contract = new printr2Abi.Contract(sqdRpcCtx, printrContractAddress);
    const curveData = await printr2Contract.getCurve(token);
    const baseTokenAddress = curveData.basePair.toLowerCase();

    // Determine token0 and token1 (Uniswap V3 ordering)
    const [token0, token1] =
      tokenAddress < baseTokenAddress
        ? [tokenAddress, baseTokenAddress]
        : [baseTokenAddress, tokenAddress];

    // Fetch token decimals and cache them
    const token0DecimalsKey = `token:${token0}:decimals`;
    const token1DecimalsKey = `token:${token1}:decimals`;
    let token0Decimals = await redis.get(token0DecimalsKey);
    let token1Decimals = await redis.get(token1DecimalsKey);

    if (!token0Decimals || !token1Decimals) {
      const token0Contract = new erc20Abi.Contract(sqdRpcCtx, token0);
      const token1Contract = new erc20Abi.Contract(sqdRpcCtx, token1);
      token0Decimals = (await token0Contract.decimals()).toString();
      token1Decimals = (await token1Contract.decimals()).toString();
      await redis.set(token0DecimalsKey, token0Decimals);
      await redis.set(token1DecimalsKey, token1Decimals);
    }

    // Determine liquidity fee based on chain
    let liquidityFee = LIQUIDITY_FEE;
    if (chainId === ChainId.BSC || chainId === ChainId.MONAD) {
      liquidityFee = LIQUIDITY_FEE_BSC;
    }

    // Try to get pool with determined fee
    const factoryContract = new factoryAbi.Contract(sqdRpcCtx, factoryAddress);
    let poolAddress: string;

    try {
      poolAddress = await factoryContract.getPool(token, curveData.basePair, liquidityFee);
    } catch (error: any) {
      // Handle case where getPool returns 0x (pool doesn't exist) which can't be decoded
      if (
        error.message?.includes('Offset is outside the bounds') ||
        error.message?.includes('0x')
      ) {
        logger.warn(`Pool does not exist with fee ${liquidityFee}, returning early`);
        return;
      }
      throw error;
    }

    if (poolAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      logger.warn(`Invalid pool with fee ${liquidityFee}:`, poolAddress);
      return;
    }

    const poolAddressLower = poolAddress.toLowerCase();

    // Store pool info in Redis
    const poolKey = `printr:pool:${poolAddressLower}`;
    await redis.set(
      poolKey,
      JSON.stringify({
        token0,
        token1,
        token: tokenAddress,
        baseToken: baseTokenAddress,
        printrContractAddress: printrContractAddress.toLowerCase(),
        factoryAddress: factoryAddress.toLowerCase(),
        fee: liquidityFee.toString(),
        discoveredAt: log.height.toString(),
      }),
    );

    // Store graduation info with pool address
    const graduationKey = `printr:token:${tokenAddress}:graduated`;
    await redis.set(
      graduationKey,
      JSON.stringify({
        blockNumber: log.height.toString(),
        timestamp: log.tsMs.toString(),
        finalSupply: finalSupply ? finalSupply.toString() : '0',
        tokenAmount: tokenAmount.toString(),
        baseAmount: baseAmount.toString(),
        poolAddress: poolAddressLower,
      }),
    );

    // Emit liquidity deployed event
    const instances =
      config.liquidityDeployed?.filter(
        (l: any) => l.params.printrldContractAddress.toLowerCase() === printrContractAddress,
      ) || [];

    logger.info(
      `[handleLiquidityDeployed] Token ${tokenAddress} graduated. Pool: ${poolAddressLower}, Matching instances: ${instances.length}`,
    );

    for (const instance of instances) {
      await emitFns.action.action({
        key: md5Hash(`${log.txRef}${log.index}`),
        user: log.address.toLowerCase(),
        activity: 'liquidityDeployed',
        trackableInstance: instance,
        amount: 0n,
        meta: {
          token: tokenAddress,
          tokenAmount: tokenAmount.toString(),
          baseAmount: baseAmount.toString(),
          finalSupply: finalSupply ? finalSupply.toString() : '0',
          poolAddress: poolAddressLower,
        },
      });
    }
  } catch (error) {
    logger.warn(`Failed to discover pool for token ${tokenAddress}:`, error);
    // Still emit the event even if pool discovery fails
    const instances =
      config.liquidityDeployed?.filter(
        (l: any) => l.params.printrldContractAddress.toLowerCase() === printrContractAddress,
      ) || [];

    for (const instance of instances) {
      await emitFns.action.action({
        key: md5Hash(`${log.txRef}${log.index}`),
        user: log.address.toLowerCase(),
        activity: 'liquidityDeployed',
        trackableInstance: instance,
        amount: 0n,
        meta: {
          token: tokenAddress,
          tokenAmount: tokenAmount.toString(),
          baseAmount: baseAmount.toString(),
          finalSupply: finalSupply ? finalSupply.toString() : '0',
        },
      });
    }
  }
}

// Handler for pool swap events
async function handlePoolSwap(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  config: any,
  poolAddress: string,
  sqdRpcCtx: SqdRpcCtx,
  redis: Redis,
): Promise<void> {
  // Check if this pool was discovered (stored in Redis)
  const poolKey = `printr:pool:${poolAddress}`;
  const poolDataStr = await redis.get(poolKey);

  if (!poolDataStr) {
    // Pool not discovered yet, skip this swap
    logger.debug(`[handlePoolSwap] Pool ${poolAddress} not discovered yet, skipping swap event`);
    return;
  }

  const poolData = JSON.parse(poolDataStr);

  // Use token addresses already stored during LiquidityDeployed
  const token0Addr = poolData.token0.toLowerCase();
  const token1Addr = poolData.token1.toLowerCase();

  // Decode swap event
  let decoded: any;
  if (log.topic0 === poolAbi.events.Swap.topic) {
    decoded = poolAbi.events.Swap.decode({
      topics: log.topics,
      data: log.data,
    });
  } else {
    decoded = pool2Abi.events.Swap.decode({
      topics: log.topics,
      data: log.data,
    });
  }

  const { sender, recipient, amount0, amount1 } = decoded;

  // Find swap instances that match this discovered pool
  // Match by factory address and printr contract address
  const instances =
    config.swap?.filter((s: any) => {
      const instanceFactory = s.params.factoryAddress?.toLowerCase();
      const instancePrintr = s.params.printrContractAddress?.toLowerCase();
      return (
        instanceFactory === poolData.factoryAddress &&
        instancePrintr === poolData.printrContractAddress
      );
    }) || [];

  if (instances.length === 0) {
    logger.debug(
      `[handlePoolSwap] No matching swap instances found for pool ${poolAddress}. Pool factory: ${poolData.factoryAddress}, Pool printr: ${poolData.printrContractAddress}`,
    );
  }

  for (const instance of instances) {
    const swapLegAddress = instance.assetSelectors?.swapLegAddress?.toLowerCase();
    const amount0Abs = amount0 < 0n ? -amount0 : amount0;
    const amount1Abs = amount1 < 0n ? -amount1 : amount1;

    // Get Printr token address (already lowercased when stored)
    const printrTokenAddr = poolData.token.toLowerCase();

    // Always emit swaps for Printr tokens (not base tokens)
    // swapLegAddress is only used for price calculation, not for filtering which swaps to emit
    const shouldEmitToken0 = token0Addr === printrTokenAddr;
    const shouldEmitToken1 = token1Addr === printrTokenAddr;

    if (shouldEmitToken0 && amount0Abs > 0n) {
      logger.debug(
        `[handlePoolSwap] Emitting swap event for token0: ${token0Addr}, amount: ${amount0Abs.toString()}, pool: ${poolAddress}`,
      );
      await emitFns.action.swap({
        key: md5Hash(`${log.txRef}${log.index}`),
        user: recipient.toLowerCase(),
        asset: { type: 'erc20', address: token0Addr },
        amount: amount0Abs,
        activity: 'swap',
        trackableInstance: instance,
        meta: {
          fromTkAddress: token0Addr,
          toTkAddress: token1Addr,
          fromTkAmount: amount0.toString(),
          toTkAmount: amount1.toString(),
          poolAddress: poolAddress.toLowerCase(),
        },
      });

      // Calculate price and market cap for graduated tokens
      // Always calculate price for Printr tokens (token0 is the Printr token)
      if (token0Addr === printrTokenAddr) {
        // Use base token (token1) as pricing reference since Printr token is token0
        const baseTokenAddr = poolData.baseToken.toLowerCase();
        const pricingReferenceToken = token1Addr; // Base token is token1 when Printr token is token0

        logger.debug(
          `[handlePoolSwap] Calculating swap value for token0 (Printr token): ${token0Addr}, pricing reference (base token): ${pricingReferenceToken}`,
        );
        // Calculate swap value in USD from base token, then derive Printr token price
        const { otherTokenPriceInUsd: otherTokenPriceInUsd0 } = await calculateSwapValueUsd(
          amount0,
          amount1,
          token0Addr,
          token1Addr,
          poolData.baseToken,
          pricingReferenceToken, // assetSelector token (base token for pricing)
          log.tsMs,
          redis,
          instance,
        );
        logger.debug(
          `[handlePoolSwap] Calculated otherTokenPriceInUsd: ${otherTokenPriceInUsd0} for Printr token ${token0Addr}`,
        );
        await checkMarketCapThresholds(
          token0Addr,
          amount0Abs,
          otherTokenPriceInUsd0,
          log.height,
          log.tsMs,
          log.chainId,
          redis,
          emitFns,
          instance,
          config,
        );
      }
    }

    if (shouldEmitToken1 && amount1Abs > 0n) {
      logger.debug(
        `[handlePoolSwap] Emitting swap event for token1: ${token1Addr}, amount: ${amount1Abs.toString()}, pool: ${poolAddress}`,
      );
      await emitFns.action.swap({
        key: md5Hash(`${log.txRef}${log.index}`),
        user: recipient.toLowerCase(),
        asset: { type: 'erc20', address: token1Addr },
        amount: amount1Abs,
        activity: 'swap',
        trackableInstance: instance,
        meta: {
          fromTkAddress: token0Addr,
          toTkAddress: token1Addr,
          fromTkAmount: amount0.toString(),
          toTkAmount: amount1.toString(),
          poolAddress: poolAddress.toLowerCase(),
        },
      });

      // Calculate price and market cap for graduated tokens
      // Always calculate price for Printr tokens (token1 is the Printr token)
      if (token1Addr === printrTokenAddr) {
        // Use base token (token0) as pricing reference since Printr token is token1
        const baseTokenAddr = poolData.baseToken.toLowerCase();
        const pricingReferenceToken = token0Addr; // Base token is token0 when Printr token is token1

        logger.debug(
          `[handlePoolSwap] Calculating swap value for token1 (Printr token): ${token1Addr}, pricing reference (base token): ${pricingReferenceToken}`,
        );
        // Calculate swap value in USD from base token, then derive Printr token price
        const { otherTokenPriceInUsd: otherTokenPriceInUsd1 } = await calculateSwapValueUsd(
          amount0,
          amount1,
          token0Addr,
          token1Addr,
          poolData.baseToken,
          pricingReferenceToken, // assetSelector token (base token for pricing)
          log.tsMs,
          redis,
          instance,
        );
        logger.debug(
          `[handlePoolSwap] Calculated otherTokenPriceInUsd: ${otherTokenPriceInUsd1} for Printr token ${token1Addr}`,
        );
        await checkMarketCapThresholds(
          token1Addr,
          amount1Abs,
          otherTokenPriceInUsd1,
          log.height,
          log.tsMs,
          log.chainId,
          redis,
          emitFns,
          instance,
          config,
        );
      }
    }
  }
}

// Handler for generic ERC-20 Transfer events
// Automatically tracks all ERC-20 tokens - no config needed!
async function handleTransfer(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  config: any,
  redis: Redis,
): Promise<void> {
  // Skip ERC-721 (NFT) Transfer events - they have 4 topics (tokenId is indexed)
  // ERC-20 Transfer events have 3 topics (from, to, value in data)
  if (log.topics.length === 4) {
    return; // This is an ERC-721 Transfer, skip it
  }

  // Only process ERC-20 Transfer events (3 topics)
  if (log.topics.length !== 3) {
    return; // Unexpected topic count, skip
  }

  const tokenAddress = log.address.toLowerCase();
  const { from, to, value } = erc20Abi.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  // Get all hold instances (no filtering needed - track all tokens automatically)
  const instances = config.hold || [];

  if (instances.length === 0) {
    return; // No hold trackable configured
  }

  // Emit balance deltas for each instance
  // All instances track the same token (dynamic discovery)
  // Note: We don't maintain a separate holder set - we'll query the engine's balance tracking
  // when MCAP thresholds are crossed (see rewardAllHolders function)
  for (const instance of instances) {
    // From address balance decreases
    if (from !== '0x0000000000000000000000000000000000000000') {
      await emitFns.position.balanceDelta({
        user: from.toLowerCase(),
        asset: { type: 'erc20', address: tokenAddress },
        amount: -BigInt(value),
        activity: 'hold',
        trackableInstance: instance,
      });
    }

    // To address balance increases
    if (to !== '0x0000000000000000000000000000000000000000') {
      await emitFns.position.balanceDelta({
        user: to.toLowerCase(),
        asset: { type: 'erc20', address: tokenAddress },
        amount: BigInt(value),
        activity: 'hold',
        trackableInstance: instance,
      });
    }
  }
}

// Check market cap thresholds and emit trigger events (Redis-first plan)
async function checkMarketCapThresholds(
  tokenAddress: string,
  tokenAmount: bigint,
  otherTokenPriceInUsd: number, // USD value of the token (not the assetSelector token)
  blockNumber: number,
  timestamp: number,
  chainId: number,
  redis: Redis,
  emitFns: EmitFunctions,
  instance: any, // Trackable instance for emitting
  config: any, // Full config to check for threshold-specific mcap_holders_{threshold} and mcap_creators_{threshold}
): Promise<void> {
  // Check if this token has graduated
  const graduationKey = `printr:token:${tokenAddress}:graduated`;
  const graduationData = await redis.get(graduationKey);
  if (!graduationData) {
    return; // Token hasn't graduated yet
  }

  const graduation = JSON.parse(graduationData);
  const finalSupply = BigInt(graduation.finalSupply);

  // Read existing token state from Redis
  const tokenStateKey = `printr:token:${chainId}:${tokenAddress}`;
  const existingState = await redis.hgetall(tokenStateKey);

  if (!existingState || Object.keys(existingState).length === 0) {
    return; // Token state not initialized
  }

  // Block guard: ignore if block < lastTradeBlock
  const lastTradeBlock = existingState.lastTradeBlock
    ? parseInt(existingState.lastTradeBlock, 10)
    : 0;
  if (blockNumber < lastTradeBlock) {
    return; // Out of order, skip
  }

  // Compute mcapUsd = otherTokenPriceInUsd * mintedSupply
  const mintedSupplyScaled = Number(finalSupply) / 1e18;
  const mcapUsd = otherTokenPriceInUsd * mintedSupplyScaled;

  // Update Redis HASH with new state
  await redis.hset(tokenStateKey, {
    priceUsd: otherTokenPriceInUsd.toString(),
    mcapUsd: mcapUsd.toString(),
    lastTradeBlock: blockNumber.toString(),
    lastTradeTs: timestamp.toString(),
  });

  // MCAP threshold check
  // Fetch maxTier reached
  const maxTierKey = `printr:mcap:maxTier:${chainId}:${tokenAddress}`;
  const maxTierStr = await redis.get(maxTierKey);
  const maxTier = maxTierStr ? parseFloat(maxTierStr) : 0;

  // Compare only next tier (O(1) check)
  for (const threshold of MCAP_THRESHOLDS) {
    if (threshold <= maxTier) {
      continue; // Already crossed this tier
    }

    if (mcapUsd >= threshold) {
      // Acquire lock to avoid double triggers
      const lockKey = `printr:mcap:lock:${chainId}:${tokenAddress}`;
      const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

      if (!lockAcquired) {
        // Another process is handling this, skip
        continue;
      }

      try {
        // Double-check tier not triggered (race condition protection)
        const currentMaxTierStr = await redis.get(maxTierKey);
        const currentMaxTier = currentMaxTierStr ? parseFloat(currentMaxTierStr) : 0;

        if (threshold <= currentMaxTier) {
          // Already triggered by another process
          continue;
        }

        // Emit threshold trigger event
        await emitFns.action.action({
          key: md5Hash(`mcap-threshold:${chainId}:${tokenAddress}:${threshold}:${blockNumber}`),
          user: '0x0000000000000000000000000000000000000000', // System event
          activity: 'mcapThreshold',
          trackableInstance: instance,
          amount: 0n,
          meta: {
            token: tokenAddress,
            chainId: chainId.toString(),
            block: blockNumber.toString(),
            timestamp: timestamp.toString(),
            tier: threshold.toString(),
            mcapUsd: mcapUsd.toString(),
            priceUsd: otherTokenPriceInUsd.toString(),
            finalSupply: finalSupply.toString(),
          },
        });

        // Reward all current holders
        // Use printrContractAddress from instance config to filter tokens
        const printrContractAddress = instance.params?.printrContractAddress?.toLowerCase();
        await rewardAllHolders(
          tokenAddress,
          threshold,
          blockNumber,
          timestamp,
          chainId,
          redis,
          emitFns,
          config,
          printrContractAddress,
        );

        // Update maxTier
        await redis.set(maxTierKey, threshold.toString());
      } finally {
        // Release lock
        await redis.del(lockKey);
      }
    } else {
      // Haven't reached this threshold yet, stop checking
      break;
    }
  }
}

// Helper function to get config key name for a threshold (holders only - creators use single config)
function getThresholdConfigKey(threshold: number, type: 'holders'): string {
  return `mcap_${type}_${threshold}`;
}

// Reward all holders when MCAP threshold is crossed
// Checks if threshold has been rewarded, acquires lock, rewards unique holders and creator with pro-rata distribution, then releases lock
// Only rewards if threshold-specific mcap_holders_{threshold} and/or mcap_creators_{threshold} trackables are configured
async function rewardAllHolders(
  tokenAddress: string,
  threshold: number,
  blockNumber: number,
  timestamp: number,
  chainId: number,
  redis: Redis,
  emitFns: EmitFunctions,
  config: any,
  printrContractAddress?: string,
): Promise<void> {
  // Get token state to retrieve creator and current MCAP
  const tokenStateKey = `printr:token:${chainId}:${tokenAddress}`;
  const tokenState = await redis.hgetall(tokenStateKey);
  if (!tokenState || Object.keys(tokenState).length === 0) {
    return; // Token state not found
  }

  const currentMcapUsd = parseFloat(tokenState.mcapUsd || '0');
  if (currentMcapUsd === 0) {
    return; // No MCAP data available
  }

  // Check if MCAP > threshold
  if (currentMcapUsd < threshold) {
    return; // MCAP hasn't reached this threshold yet
  }

  // Check if this threshold has already been rewarded
  const rewardedKey = `printr:mcap:rewarded:${chainId}:${tokenAddress}:${threshold}`;
  const alreadyRewarded = await redis.get(rewardedKey);
  if (alreadyRewarded === '1') {
    return; // This threshold has already been rewarded
  }

  // Acquire lock to prevent concurrent reward processing
  const lockKey = `printr:mcap:reward-lock:${chainId}:${tokenAddress}:${threshold}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

  if (!lockAcquired) {
    // Another process is handling this, skip
    return;
  }

  try {
    // Double-check threshold not rewarded (race condition protection)
    const currentRewarded = await redis.get(rewardedKey);
    if (currentRewarded === '1') {
      // Already rewarded by another process
      return;
    }

    // Verify this token belongs to the Printr contract from config
    if (printrContractAddress) {
      const graduationKey = `printr:token:${tokenAddress}:graduated`;
      const graduationData = await redis.get(graduationKey);
      if (graduationData) {
        const graduation = JSON.parse(graduationData);
        if (graduation.poolAddress) {
          const poolKey = `printr:pool:${graduation.poolAddress}`;
          const poolDataStr = await redis.get(poolKey);
          if (poolDataStr) {
            const poolData = JSON.parse(poolDataStr);
            if (poolData.printrContractAddress?.toLowerCase() !== printrContractAddress) {
              // Token doesn't belong to this Printr contract, skip
              return;
            }
          }
        }
      } else {
        // Token hasn't graduated, check if it has curve created by this contract
        const tokenStateCheck = await redis.hgetall(tokenStateKey);
        if (!tokenStateCheck || Object.keys(tokenStateCheck).length === 0) {
          // Token not tracked by this Printr contract, skip
          return;
        }
      }
    }

    const creator = tokenState.creator?.toLowerCase();
    if (!creator) {
      logger.warn(`No creator found for token ${tokenAddress}`);
      return;
    }

    // Get milestone points for this threshold
    const milestonePoints = MCAP_MILESTONE_POINTS[threshold];
    if (!milestonePoints) {
      logger.warn(`No milestone points found for threshold ${threshold}`);
      return;
    }

    const holdersPoints = milestonePoints.holdersPoints;
    const creatorPoints = milestonePoints.creatorPoints;

    // Get threshold-specific config key for holders
    const holdersConfigKey = getThresholdConfigKey(threshold, 'holders');

    // Check if threshold-specific mcap_holders trackable is configured
    // Note: We don't filter by address - just use all instances from the config key
    const mcapHoldersInstances = config[holdersConfigKey] || [];

    // Check if mcap_creators trackable is configured (single config for all thresholds)
    // Note: We don't filter by address - just use all instances from the config
    const mcapCreatorsInstances = config.mcap_creators || [];

    // Only proceed if at least one of the trackables is configured
    if (mcapHoldersInstances.length === 0 && mcapCreatorsInstances.length === 0) {
      logger.debug(
        `Skipping rewards for token ${tokenAddress} at threshold ${threshold} - ${holdersConfigKey} and mcap_creators not configured`,
      );
      return;
    }

    // Get holders with their balances for pro-rata distribution (only if mcap_holders is configured)
    const holderBalances = new Map<string, bigint>(); // Map<address, balance>
    let totalHoldings = 0n;

    if (mcapHoldersInstances.length > 0) {
      // Balance key format: bal:erc20:{tokenAddress}:{userAddress}
      const assetKey = `erc20:${tokenAddress.toLowerCase()}`;
      const balancePrefix = `bal:${assetKey}:`;

      // Get all balance keys for this token from the engine's active balances set
      const allBalanceKeys = await redis.smembers('balances:gt0');
      const inactiveBalanceKeys = await redis.smembers('inactivebalances');

      // Filter to only balance keys for this specific token (excluding inactive)
      const tokenBalanceKeys = allBalanceKeys.filter(
        (key) => key.startsWith(balancePrefix) && !inactiveBalanceKeys.includes(key),
      );

      // Fetch all balances in parallel
      const balancePromises = tokenBalanceKeys.map(async (balanceKey) => {
        const balanceData = await redis.hget(balanceKey, 'amount');
        if (balanceData) {
          const balance = BigInt(balanceData);
          if (balance > 0n) {
            // Extract user address from balance key: bal:erc20:{tokenAddress}:{userAddress}
            const userAddress = balanceKey.substring(balancePrefix.length).toLowerCase();
            holderBalances.set(userAddress, balance);
            totalHoldings += balance;
          }
        }
      });

      await Promise.all(balancePromises);
    }

    logger.info(
      `Rewarding token ${tokenAddress} for threshold $${threshold.toLocaleString()} (MCAP: $${currentMcapUsd.toLocaleString()}). Total holders: ${holderBalances.size}, Total holdings: ${totalHoldings.toString()}, Points pool: ${holdersPoints.toLocaleString()} for holders, ${creatorPoints.toLocaleString()} for creator`,
    );

    // Reward each holder with pro-rata distribution (if mcap_holders is configured)
    if (mcapHoldersInstances.length > 0 && holderBalances.size > 0 && totalHoldings > 0n) {
      for (const [holderAddress, balance] of holderBalances.entries()) {
        // Calculate pro-rata share: (holderBalance / totalHoldings) * holdersPoints
        const balanceRatio = Number(balance) / Number(totalHoldings);
        const proRataPoints = holdersPoints * balanceRatio;

        // Fan out: emit for each configured mcap_holders instance
        for (const instance of mcapHoldersInstances) {
          await emitFns.action.action({
            key: md5Hash(`mcap-holders:${chainId}:${tokenAddress}:${threshold}:${holderAddress}`),
            user: holderAddress,
            activity: holdersConfigKey, // Use threshold-specific activity name
            trackableInstance: instance,
            amount: BigInt(Math.floor(proRataPoints)),
            meta: {
              token: tokenAddress,
              chainId: chainId.toString(),
              block: blockNumber.toString(),
              timestamp: timestamp.toString(),
              threshold: threshold.toString(),
              mcapUsd: currentMcapUsd.toString(),
              holdersPoints: holdersPoints.toString(),
              holderBalance: balance.toString(),
              totalHoldings: totalHoldings.toString(),
              proRataPoints: proRataPoints.toString(),
              balanceRatio: balanceRatio.toString(),
              rewardType: 'mcapThreshold',
            },
          });
        }
      }
    }

    // Reward creator with full creator points (no pro-rata, if mcap_creators is configured)
    if (mcapCreatorsInstances.length > 0 && creatorPoints > 0) {
      // Fan out: emit for each configured mcap_creators instance
      for (const instance of mcapCreatorsInstances) {
        await emitFns.action.action({
          key: md5Hash(`mcap-creators:${chainId}:${tokenAddress}:${threshold}:${creator}`),
          user: creator,
          activity: 'mcap_creators', // Single activity name for all thresholds
          trackableInstance: instance,
          amount: BigInt(Math.floor(creatorPoints)), // Full points amount (no pro-rata)
          meta: {
            token: tokenAddress,
            chainId: chainId.toString(),
            block: blockNumber.toString(),
            timestamp: timestamp.toString(),
            threshold: threshold.toString(),
            mcapUsd: currentMcapUsd.toString(),
            creatorPoints: creatorPoints.toString(),
            rewardType: 'mcapThreshold',
          },
        });
      }
    }

    // Mark this threshold as rewarded
    await redis.set(rewardedKey, '1');

    const holdersRewarded = mcapHoldersInstances.length > 0 ? holderBalances.size : 0;
    const creatorsRewarded = mcapCreatorsInstances.length > 0 ? 1 : 0;
    logger.info(
      `Emitted ${holdersRewarded} holder reward events (pro-rata) and ${creatorsRewarded} creator reward event(s) for token ${tokenAddress} at threshold $${threshold.toLocaleString()}`,
    );
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}
