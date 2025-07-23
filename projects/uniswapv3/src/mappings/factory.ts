import { BlockData, DataHandlerContext, assertNotNull } from '@subsquid/evm-processor';
import { logger } from '@absinthe/common';
import * as factoryAbi from '../abi/factory';
import { BlockMap } from '../utils/blockMap';
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
import { ContextWithEntityManager, Token, PairCreatedData } from '../utils/interfaces/univ3Types';

export async function processFactory(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
  factoryAddress: string,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🏭 [Factory] Processing ${blocks.length} blocks for factory: ${factoryAddress}`);
  const startTime = Date.now();

  const newPairsData = await processItems(blocks, factoryAddress);
  const tokens: Token[] = [];

  if (newPairsData.size == 0) {
    logger.info(`🏭 [Factory] No new pairs found in ${blocks.length} blocks`);
    return;
  }

  logger.info(`🏭 [Factory] Found ${newPairsData.size} blocks with new pairs`);

  for (const [blockNumber, blockEventsData] of newPairsData) {
    logger.info(
      `🏭 [Factory] Processing block ${blockNumber} with ${blockEventsData.length} pair(s)`,
    );
    for (const data of blockEventsData) {
      logger.info(
        `🏭 [Factory] Creating tokens for pair: ${data.token0Id}/${data.token1Id}, pool: ${data.poolId}, fee: ${data.fee}`,
      );
      const token0 = createToken(data.token0Id);
      const token1 = createToken(data.token1Id);
      tokens.push(token0);
      tokens.push(token1);
    }
  }

  logger.info(`🏭 [Factory] Created ${tokens.length} tokens, syncing metadata...`);
  await syncTokens({ ...ctx, block: last(blocks).header }, tokens);

  logger.info(`🏭 [Factory] Storing ${tokens.length} tokens in position storage...`);
  await positionStorageService.storeMultipleTokens(tokens);

  const duration = Date.now() - startTime;
  logger.info(
    `🏭 [Factory] Completed processing in ${duration}ms - ${tokens.length / 2} pairs, ${tokens.length} tokens`,
  );
}

async function processItems(blocks: BlockData[], factoryAddress: string) {
  logger.info(`🔍 [Factory] Scanning ${blocks.length} blocks for PoolCreated events...`);
  let newPairsData = new BlockMap<PairCreatedData>();
  let totalLogs = 0;
  let relevantLogs = 0;

  for (let block of blocks) {
    let blockPairs = 0;
    for (let log of block.logs) {
      totalLogs++;
      if (
        log.topics[0] == factoryAbi.events.PoolCreated.topic &&
        log.address.toLowerCase() == factoryAddress.toLowerCase()
      ) {
        relevantLogs++;
        blockPairs++;
        const { pool, token0, token1, fee } = factoryAbi.events.PoolCreated.decode(log);
        logger.info(
          `📝 [Factory] Block ${block.header.height}: New pool created - ${token0}/${token1} (${pool}) with fee ${fee}`,
        );
        newPairsData.push(block.header, {
          poolId: pool.toLowerCase(),
          token0Id: token0.toLowerCase(),
          token1Id: token1.toLowerCase(),
          fee: fee,
        });
      }
    }
    if (blockPairs > 0) {
      logger.info(`🔍 [Factory] Block ${block.header.height}: Found ${blockPairs} new pair(s)`);
    }
  }

  logger.info(
    `🔍 [Factory] Scan complete: ${relevantLogs} PoolCreated events found out of ${totalLogs} total logs`,
  );
  return newPairsData;
}

function createToken(id: string) {
  logger.info(`🪙 [Factory] Creating token placeholder for: ${id}`);
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
  logger.info(
    `🔄 [Factory] Syncing metadata for ${tokens.length} tokens: [${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}]`,
  );

  try {
    const [symbols, names, totalSupplies, decimals] = await Promise.all([
      fetchTokensSymbol(ctx, ids),
      fetchTokensName(ctx, ids),
      fetchTokensTotalSupply(ctx, ids),
      fetchTokensDecimals(ctx, ids),
    ]);

    logger.info(`🔄 [Factory] Fetched metadata, updating ${tokens.length} token objects...`);
    let successCount = 0;
    let errorCount = 0;

    for (const token of tokens) {
      try {
        token.symbol = assertNotNull(symbols.get(token.id));
        token.name = assertNotNull(names.get(token.id));
        token.totalSupply = BigInt(totalSupplies.get(token.id) || '0');
        token.decimals = Number(assertNotNull(decimals.get(token.id)));
        successCount++;
        logger.info(
          `🪙 [Factory] Updated token ${token.id}: ${token.symbol} (${token.name}) - ${token.decimals} decimals`,
        );
      } catch (error) {
        errorCount++;
        logger.error(`❌ [Factory] Failed to update token ${token.id}:`, error);
      }
    }

    logger.info(
      `🔄 [Factory] Token sync complete: ${successCount} successful, ${errorCount} failed`,
    );
  } catch (error) {
    logger.error(`❌ [Factory] Critical error during token metadata sync:`, error);
    throw error;
  }
}
