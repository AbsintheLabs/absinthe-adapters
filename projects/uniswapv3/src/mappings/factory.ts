import { BlockData, DataHandlerContext, assertNotNull } from '@subsquid/evm-processor';
import * as factoryAbi from '../abi/factory';
import { BlockMap } from '../utils/blockMap';
import { FACTORY_ADDRESS, WHITELIST_TOKENS } from '../utils/constants';
import { EntityManager } from '../utils/entityManager';
import {
  fetchTokensDecimals,
  fetchTokensName,
  fetchTokensSymbol,
  fetchTokensTotalSupply,
} from '../utils/token';
import { last } from '../utils/tools';
import { Store } from '@subsquid/typeorm-store';
import { BlockHandlerContext } from '../utils/interfaces/interfaces';
import { PositionStorageService } from '../services/PositionStorageService';

interface PairCreatedData {
  poolId: string;
  token0Id: string;
  token1Id: string;
  fee: number;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  totalSupply: bigint;
  decimals: number;
}

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

export async function processFactory(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
  positionStorageService: PositionStorageService,
): Promise<void> {
  const newPairsData = await processItems(blocks);
  const tokens: Token[] = [];
  console.log('newPairsData', newPairsData.size);
  if (newPairsData.size == 0) return;

  for (const [, blockEventsData] of newPairsData) {
    for (const data of blockEventsData) {
      const token0 = createToken(data.token0Id);
      const token1 = createToken(data.token1Id);
      tokens.push(token0);
      tokens.push(token1);
    }
  }
  await syncTokens({ ...ctx, block: last(blocks).header }, tokens);
  await positionStorageService.storeMultipleTokens(tokens);

  //todo: save in redis
  // await ctx.store.save(ctx.entities.values(Token));
}

// async function prefetchTokens(
//   ctx: ContextWithEntityManager,
//   eventsData: BlockMap<PairCreatedData>,
// ) {
//   for (const [, blockEventsData] of eventsData) {
//     for (const data of blockEventsData) {
//       ctx.entities.defer(Token, data.token0Id, data.token1Id);
//     }
//   }
//   await ctx.entities.load(Token);
// }

async function processItems(blocks: BlockData[]) {
  let newPairsData = new BlockMap<PairCreatedData>();

  for (let block of blocks) {
    for (let log of block.logs) {
      if (
        log.topics[0] == factoryAbi.events.PoolCreated.topic &&
        log.address.toLowerCase() == FACTORY_ADDRESS.toLowerCase()
      ) {
        const { pool, token0, token1, fee } = factoryAbi.events.PoolCreated.decode(log);
        newPairsData.push(block.header, {
          poolId: pool.toLowerCase(),
          token0Id: token0.toLowerCase(),
          token1Id: token1.toLowerCase(),
          fee: fee,
        });
      }
    }
  }

  return newPairsData;
}

function createToken(id: string) {
  const token = {
    id,
    symbol: 'unknown',
    name: 'unknown',
    totalSupply: 0n,
    decimals: 0,
  };

  return token;
}

async function syncTokens(ctx: BlockHandlerContext<Store>, tokens: Token[]) {
  const ids = tokens.map((t) => t.id);
  const [symbols, names, totalSupplies, decimals] = await Promise.all([
    fetchTokensSymbol(ctx, ids),
    fetchTokensName(ctx, ids),
    fetchTokensTotalSupply(ctx, ids),
    fetchTokensDecimals(ctx, ids),
  ]);

  for (const token of tokens) {
    token.symbol = assertNotNull(symbols.get(token.id));
    token.name = assertNotNull(names.get(token.id));
    token.totalSupply = BigInt(totalSupplies.get(token.id) || '0');
    token.decimals = Number(assertNotNull(decimals.get(token.id)));
  }
}
