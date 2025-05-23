// sqd
import { Store } from '@subsquid/typeorm-store';
import { PoolConfig, PoolState, Token } from '../model';
import { BlockData, DataHandlerContext } from '@subsquid/evm-processor';

// abis
import * as univ2Abi from '../abi/univ2';
import * as erc20Abi from '../abi/erc20';

// exported functions
export async function updatePoolStateFromOnChain(ctx: DataHandlerContext<Store>, block: BlockData, contractAddress: string, poolConfig: PoolConfig): Promise<PoolState> {
    if (!poolConfig.id || !poolConfig.lpToken || !poolConfig.token0 || !poolConfig.token1) throw new Error("Pool config not found");

    console.log("Updating pool state from on chain");
    const contract = new univ2Abi.Contract(ctx, block.header, contractAddress);
    const reserve = await contract.getReserves();
    const totalSupply = await contract.totalSupply();
    const r0 = reserve._reserve0;
    const r1 = reserve._reserve1;

    // BUG: we need to pass through the lastInterpolatedTs (perhaps it makes sense to keep this as a separate entity rather than the state since it gets modified not via on-chain state but the processor state?)
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

export async function initPoolStateIfNeeded(ctx: DataHandlerContext<Store>, block: BlockData, contractAddress: string, poolState: PoolState, poolConfig: PoolConfig): Promise<PoolState> {
    // if already defined, do nothing
    if (poolState.id) return poolState;

    // if not found, create a new pool state
    return await updatePoolStateFromOnChain(ctx, block, contractAddress, poolConfig);
}

export async function initPoolConfigIfNeeded(ctx: DataHandlerContext<Store>, block: BlockData, contractAddress: string, poolConfig: PoolConfig): Promise<PoolConfig> {
    // if already defined, do nothing
    if (poolConfig.id && poolConfig.lpToken && poolConfig.token0 && poolConfig.token1) return poolConfig;

    // if not found, create a new pool config
    // pool contract
    const contract = new univ2Abi.Contract(ctx, block.header, contractAddress);
    const lpDecimals = await contract.decimals();
    const token0Address = await contract.token0();
    const token1Address = await contract.token1();

    // token0 contract
    const token0Contract = new erc20Abi.Contract(ctx, block.header, token0Address);
    const token0Decimals = await token0Contract.decimals();

    // token1 contract
    const token1Contract = new erc20Abi.Contract(ctx, block.header, token1Address);
    const token1Decimals = await token1Contract.decimals();

    // coingecko ids
    const token1CoingeckoId = process.env.TOKEN1_COINGECKO_ID!;
    const token0CoingeckoId = process.env.TOKEN0_COINGECKO_ID!;

    // create tokens
    const lpToken = new Token({ id: `${contractAddress}-lp`, address: contractAddress, decimals: lpDecimals, coingeckoId: process.env.LP_TOKEN_COINGECKO_ID! });
    const token0 = new Token({ id: token0Address, address: token0Address, decimals: token0Decimals, coingeckoId: token0CoingeckoId });
    const token1 = new Token({ id: token1Address, address: token1Address, decimals: token1Decimals, coingeckoId: token1CoingeckoId });

    // insert pool config into db
    const newPoolConfig = new PoolConfig({
        // todo: figure out what the id is and if we really need it here
        id: `${contractAddress}-config`,
        lpToken,
        token0,
        token1,
    });
    return newPoolConfig;
}

export async function loadPoolStateFromDb(ctx: DataHandlerContext<Store>, contractAddress: string): Promise<PoolState | void> {
    const poolState = await ctx.store.findOne(PoolState, {
        where: { id: `${contractAddress}-state` },
        relations: { pool: true }
    });
    return poolState || undefined;
}

export async function loadPoolConfigFromDb(ctx: DataHandlerContext<Store>, contractAddress: string): Promise<PoolConfig | void> {
    const poolConfig = await ctx.store.findOne(PoolConfig, {
        where: { id: `${contractAddress}-config` },
        relations: { token0: true, token1: true, lpToken: true }
    });
    return poolConfig || undefined;
}