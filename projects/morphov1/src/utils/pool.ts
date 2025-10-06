import { Store } from '@subsquid/typeorm-store';
import { ActiveBalances, MarketData, PoolProcessState } from '../model';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { ActiveBalancesMorpho, MarketDataType } from '../utils/types';

import { ActiveBalance, jsonToMap } from '@absinthe/common';

export async function loadActiveBalancesFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<ActiveBalancesMorpho | undefined> {
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });

  if (!activeBalancesEntity) return undefined;

  const flatMap = jsonToMap(activeBalancesEntity.activeBalancesMap as ActiveBalancesMorpho);
  const nestedMap = new Map<string, Map<string, ActiveBalance>>();

  for (const [key, value] of flatMap.entries()) {
    const [tokenAddress, eoaAddress] = key.split('-');
    if (!nestedMap.has(tokenAddress)) {
      nestedMap.set(tokenAddress, new Map());
    }
    nestedMap.get(tokenAddress)!.set(eoaAddress, value);
  }

  return nestedMap;
}

export async function loadPoolProcessStateFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<PoolProcessState | void> {
  const poolProcessState = await ctx.store.findOne(PoolProcessState, {
    where: { id: `${contractAddress}-process-state` },
  });
  return poolProcessState || undefined;
}

export async function loadMarketDataFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<Map<string, MarketDataType> | undefined> {
  const marketData = await ctx.store.findOne(MarketData, {
    where: { id: `${contractAddress}-market-data` },
  });

  if (!marketData) return undefined;

  // Convert the stored JSON back to a Map
  const marketDataMap = new Map<string, MarketDataType>();
  for (const [key, value] of Object.entries(marketData.marketDataMap as MarketDataType)) {
    marketDataMap.set(key, {
      loanToken: value.loanToken,
      collateralToken: value.collateralToken,
      oracle: value.oracle,
      irm: value.irm,
      lltv: BigInt(value.lltv),
      borrowIndex: BigInt(value.borrowIndex),
      supplyIndex: BigInt(value.supplyIndex),
    });
  }

  return marketDataMap;
}
