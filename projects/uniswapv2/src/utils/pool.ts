// sqd
import { Store } from '@subsquid/typeorm-store';
import { PoolConfig, PoolState, Token, PoolProcessState, ActiveBalances } from '../model';
import { BlockData, DataHandlerContext } from '@subsquid/evm-processor';
import { ActiveBalance, ProtocolConfig } from '@absinthe/common';

// abis
import * as univ2Abi from '../abi/univ2';
import * as univ2LpAbi from '../abi/univ2LP';
import { jsonToMap } from '@absinthe/common';

// exported functions
export async function updatePoolStateFromOnChain(
  ctx: DataHandlerContext<Store>,
  block: BlockData,
  contractAddress: string,
  poolConfig: PoolConfig,
): Promise<PoolState> {
  if (!poolConfig.id || !poolConfig.lpToken || !poolConfig.token0 || !poolConfig.token1)
    throw new Error('Pool config not found');

  const contract = new univ2Abi.Contract(ctx, block.header, contractAddress);
  const reserve = await contract.getReserves();
  const totalSupply = await contract.totalSupply();
  const r0 = reserve._reserve0;
  const r1 = reserve._reserve1;

  const newPoolState = new PoolState({
    id: `${contractAddress}-state`,
    pool: poolConfig,
    reserve0: r0,
    reserve1: r1,
    totalSupply,
    lastBlock: block.header.height,
    lastTsMs: BigInt(block.header.timestamp),
    isDirty: false,
    updatedAt: new Date(),
  });

  return newPoolState;
}

export async function initPoolStateIfNeeded(
  ctx: DataHandlerContext<Store>,
  block: BlockData,
  contractAddress: string,
  poolState: PoolState,
  poolConfig: PoolConfig,
): Promise<PoolState> {
  // if already defined, do nothing
  if (poolState.id) return poolState;

  // if not found, create a new pool state
  return await updatePoolStateFromOnChain(ctx, block, contractAddress, poolConfig);
}

export async function initPoolConfigIfNeeded(
  ctx: DataHandlerContext<Store>,
  block: BlockData,
  contractAddress: string,
  poolConfig: PoolConfig,
  protocol: ProtocolConfig,
): Promise<PoolConfig> {
  // if already defined, do nothing
  if (poolConfig.id && poolConfig.lpToken && poolConfig.token0 && poolConfig.token1)
    return poolConfig;

  try {
    // pool contract
    const contract = new univ2Abi.Contract(ctx, block.header, contractAddress);
    const lpDecimals = await contract.decimals();
    const token0Address = await contract.token0();
    const token1Address = await contract.token1();

    // token0 contract
    const token0Contract = new univ2LpAbi.Contract(ctx, block.header, token0Address);
    const token0Decimals = await token0Contract.decimals();

    // token1 contract
    const token1Contract = new univ2LpAbi.Contract(ctx, block.header, token1Address);
    const token1Decimals = await token1Contract.decimals();

    // create tokens
    const lpToken = new Token({
      id: `${contractAddress}-lp`,
      address: contractAddress,
      decimals: lpDecimals,
      coingeckoId: null,
    });
    const token0 = new Token({
      id: `${token0Address}-token0`,
      address: token0Address,
      decimals: token0Decimals,
      coingeckoId: protocol.token0.coingeckoId,
    });
    const token1 = new Token({
      id: `${token1Address}-token1`,
      address: token1Address,
      decimals: token1Decimals,
      coingeckoId: protocol.token1.coingeckoId,
    });

    // insert pool config into db
    const newPoolConfig = new PoolConfig({
      id: `${contractAddress}-config`,
      lpToken,
      token0,
      token1,
    });
    return newPoolConfig;
  } catch (error) {
    console.warn(
      `Failed to initialize pool config for ${contractAddress} at block ${block.header.height}:`,
      (error as Error).message,
    );
    // Return existing config or throw if you want to stop processing
    return poolConfig;
  }
}

// Initial data loading functions from db
export async function loadPoolStateFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<PoolState | void> {
  const poolState = await ctx.store.findOne(PoolState, {
    where: { id: `${contractAddress}-state` },
    relations: { pool: true },
  });
  return poolState || undefined;
}

export async function loadPoolConfigFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<PoolConfig | void> {
  const poolConfig = await ctx.store.findOne(PoolConfig, {
    where: { id: `${contractAddress}-config` },
    relations: { token0: true, token1: true, lpToken: true },
  });
  return poolConfig || undefined;
}

export async function loadPoolProcessStateFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<PoolProcessState | void> {
  const poolProcessState = await ctx.store.findOne(PoolProcessState, {
    where: { id: `${contractAddress}-process-state` },
    relations: { pool: true },
  });
  return poolProcessState || undefined;
}

export async function loadActiveBalancesFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<Map<string, ActiveBalance> | undefined> {
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });
  return activeBalancesEntity
    ? jsonToMap(activeBalancesEntity.activeBalancesMap as Record<string, ActiveBalance>)
    : undefined;
}

export async function initPoolProcessStateIfNeeded(
  ctx: DataHandlerContext<Store>,
  block: BlockData,
  contractAddress: string,
  poolConfig: PoolConfig,
  poolProcessState: PoolProcessState | undefined,
): Promise<PoolProcessState> {
  // If already defined, do nothing
  if (poolProcessState?.id) return poolProcessState;

  // If not found, create a new pool process state
  return new PoolProcessState({
    id: `${contractAddress}-process-state`,
    pool: poolConfig,
    lastInterpolatedTs: undefined,
  });
}
