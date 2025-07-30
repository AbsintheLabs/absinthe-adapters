import { Store } from '@subsquid/typeorm-store';
import { ActiveBalances, PoolProcessState } from '../model/index';
import { DataHandlerContext } from '@subsquid/evm-processor';

import { ActiveBalance, jsonToMap } from '@absinthe/common';

export async function loadActiveBalancesFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<Map<string, ActiveBalance> | undefined> {
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });
  console.log('activeBalancesEntity', JSON.stringify(activeBalancesEntity));
  return activeBalancesEntity
    ? jsonToMap(activeBalancesEntity.activeBalancesMap as Record<string, ActiveBalance>)
    : undefined;
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
