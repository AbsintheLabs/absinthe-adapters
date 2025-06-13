import { Store } from '@subsquid/typeorm-store';
import { ActiveBalances, PoolProcessState } from '../model/index';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { ActiveBalancesHemi } from './types';

import { ActiveBalance, jsonToMap } from '@absinthe/common';

export async function loadActiveBalancesFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<ActiveBalancesHemi | undefined> {
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });

  if (!activeBalancesEntity) return undefined;

  const flatMap = jsonToMap(activeBalancesEntity.activeBalancesMap as ActiveBalancesHemi);
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
