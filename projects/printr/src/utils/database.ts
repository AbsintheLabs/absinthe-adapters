import { PoolInfo, TokenInfo } from './types';
import { Pool, Token } from '../model';

async function saveTokensToDb(ctx: any, tokenState: Map<string, TokenInfo>) {
  for (const token of tokenState.values()) {
    await ctx.store.upsert(
      new Token({
        id: token.id,
        decimals: token.decimals,
      }),
    );
  }
}

// Save all pools
async function savePoolsToDb(ctx: any, poolState: Map<string, PoolInfo>) {
  for (const pool of poolState.values()) {
    await ctx.store.upsert(
      new Pool({
        id: pool.address,
        address: pool.address,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
        fee: pool.fee,
        isActive: pool.isActive,
      }),
    );
  }
}

async function loadTokensFromDb(ctx: any): Promise<Map<string, TokenInfo>> {
  const tokens = new Map<string, TokenInfo>();
  const tokenEntities = await ctx.store.find(Token, {});
  for (const t of tokenEntities) {
    tokens.set(t.id, {
      id: t.id,
      decimals: t.decimals,
    });
  }
  return tokens;
}

async function loadPoolsFromDb(ctx: any): Promise<Map<string, PoolInfo>> {
  const pools = new Map<string, PoolInfo>();
  const poolEntities = await ctx.store.find(Pool, {});
  for (const p of poolEntities) {
    pools.set(p.address.toLowerCase(), {
      address: p.address.toLowerCase(),
      token0Address: p.token0Address.toLowerCase(),
      token1Address: p.token1Address.toLowerCase(),
      fee: p.fee,
      isActive: p.isActive,
    });
  }
  return pools;
}

export { saveTokensToDb, savePoolsToDb, loadTokensFromDb, loadPoolsFromDb };
