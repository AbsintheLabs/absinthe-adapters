import { BigDecimal } from '@subsquid/big-decimal';

import {
  BlockHandlerContext,
  CommonHandlerContext,
  BlockHeader,
} from '../utils/interfaces/interfaces';
import * as factoryAbi from './../abi/factory';
import { Multicall } from '../abi/multicall';
import { BlockMap } from '../utils/blockMap';
import {
  FACTORY_ADDRESS,
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
  POSITIONS_ADDRESS,
} from '../utils/constants';
import { EntityManager } from '../utils/entityManager';
import { last } from '../utils/tools';
import * as positionsAbi from './../abi/NonfungiblePositionManager';
import { BlockData, DataHandlerContext } from '@subsquid/evm-processor';
import { EvmLog } from '@subsquid/evm-processor/src/interfaces/evm';
import { Store } from '@subsquid/typeorm-store';
import { PositionTracker } from '../services/PositionTracker';
import { PositionStorageService } from '../services/PositionStorageService';
import { fetchHistoricalUsd, HistoryWindow, Transaction } from '@absinthe/common';

type EventData =
  | (TransferData & { type: 'Transfer' })
  | (IncreaseData & { type: 'Increase' })
  | (DecreaseData & { type: 'Decrease' });

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

interface ProtocolStateUniswapV3 {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

interface PositionData {
  positionId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  token0Id: string;
  token1Id: string;
  fee: number;
  depositedToken0: string;
  depositedToken1: string;
  isActive: string;
  isTracked: string;
  lastUpdatedBlockTs: number;
  lastUpdatedBlockHeight: number;
  poolId: string;
}

export async function processPositions(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
): Promise<void> {
  const eventsData = processItems(ctx, blocks);
  if (!eventsData || eventsData.size == 0) return;

  await prefetch(ctx, eventsData, last(blocks).header, positionStorageService);

  for (const [block, blockEventsData] of eventsData) {
    for (const data of blockEventsData) {
      switch (data.type) {
        case 'Increase':
          await processIncreaseData(
            ctx,
            block,
            data,
            protocolStates,
            positionTracker,
            positionStorageService,
            coingeckoApiKey,
          );
          break;
        case 'Decrease':
          await processDecreaseData(
            ctx,
            block,
            data,
            protocolStates,
            positionTracker,
            positionStorageService,
            coingeckoApiKey,
          );
          break;
        case 'Transfer':
          await processTransferData(ctx, block, data, protocolStates, positionTracker);
          break;
      }
    }
  }

  // await updateFeeVars(createContext(last(blocks).header), ctx.entities.values(Position))
}

async function prefetch(
  ctx: ContextWithEntityManager,
  eventsData: BlockMap<EventData>,
  block: BlockHeader,
  positionStorageService: PositionStorageService,
) {
  const positionIds = new Set<string>();
  for (const [, blockEventsData] of eventsData) {
    for (const data of blockEventsData) {
      const checkIfPositionExists = await positionStorageService.checkIfPositionExists(
        data.tokenId,
      );
      if (checkIfPositionExists) {
        positionIds.add(data.tokenId);
      }
    }
  }
  const positions = await initPositions({ ...ctx, block }, Array.from(positionIds));
  await positionStorageService.storeBatchPositions(positions);
}

function processItems(ctx: CommonHandlerContext<unknown>, blocks: BlockData[]) {
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
      switch (log.topics[0]) {
        case positionsAbi.events.IncreaseLiquidity.topic: {
          const data = processInreaseLiquidity(evmLog);
          eventsData.push(block.header, {
            type: 'Increase',
            ...data,
          });
          break;
        }
        case positionsAbi.events.DecreaseLiquidity.topic: {
          const data = processDecreaseLiquidity(evmLog);
          eventsData.push(block.header, {
            type: 'Decrease',
            ...data,
          });
          break;
        }
        case positionsAbi.events.Transfer.topic: {
          const data = processTransfer(evmLog);
          eventsData.push(block.header, {
            type: 'Transfer',
            ...data,
          });
          break;
        }
      }
    }
  }

  return eventsData;
}

async function processIncreaseData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: IncreaseData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
) {
  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) return;

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);

  const token0inETH = await fetchHistoricalUsd(
    token0!.id, //todo: should be coingecko id
    block.timestamp,
    coingeckoApiKey,
  );
  const token1inETH = await fetchHistoricalUsd(
    token1!.id, //todo: should be coingecko id
    block.timestamp,
    coingeckoApiKey,
  );
  const amount0 = BigDecimal(data.amount0, token0!.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1!.decimals).toNumber();
  const amountMintedETH = amount0 * token0inETH + amount1 * token1inETH;
  const trackerData = await positionTracker.handleIncreaseLiquidity(block, data, amountMintedETH);

  if (trackerData) {
    protocolStates.get(position.poolId)!.balanceWindows.push(trackerData);
    console.log(trackerData, 'got the data');
  }
}

async function processDecreaseData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: DecreaseData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
) {
  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) return;

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);

  // let prices = sqrtPriceX96ToTokenPrices(
  //   BigInt(priceMetadata?.sqrtPriceX96 || '0'),
  //   token0!.decimals,
  //   token1!.decimals,
  // );
  // const token0Price = prices[0];
  // const token1Price = prices[1];

  const token0inETH = await fetchHistoricalUsd(
    token0!.id, //todo: should be coingecko id
    block.timestamp,
    coingeckoApiKey,
  );
  const token1inETH = await fetchHistoricalUsd(
    token1!.id, //todo: should be coingecko id
    block.timestamp,
    coingeckoApiKey,
  );
  const amount0 = BigDecimal(data.amount0, token0!.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1!.decimals).toNumber();
  const amountBurnedETH = amount0 * token0inETH + amount1 * token1inETH;

  const trackerData = await positionTracker.handleDecreaseLiquidity(block, data, amountBurnedETH);

  if (trackerData) {
    protocolStates.get(position.poolId)!.balanceWindows.push(trackerData);
    console.log(trackerData, 'got the data');
  }
}

async function processTransferData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: TransferData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
) {
  const trackerData = await positionTracker.handleTransfer(block, data);
  //todo: check if we need any of the above data from here
  if (trackerData) {
    //todo: test
    // protocolStates.get(position.poolId)!.balanceWindows.push(trackerData);
    console.log(trackerData, 'got the data');
  }
}

async function initPositions(ctx: BlockHandlerContext<Store>, ids: string[]) {
  const positions: PositionData[] = [];
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const positionResults = await multicall.tryAggregate(
    positionsAbi.functions.positions,
    POSITIONS_ADDRESS,
    ids.map((id) => {
      return { tokenId: BigInt(id) };
    }),
    MULTICALL_PAGE_SIZE,
  );

  const owners = await multicall.aggregate(
    positionsAbi.functions.ownerOf,
    POSITIONS_ADDRESS,
    ids.map((id) => {
      return { tokenId: BigInt(id) };
    }),
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < ids.length; i++) {
    const result = positionResults[i];
    const owner = owners[i];
    if (result.success) {
      //todo: check after testing
      positions.push({
        positionId: ids[i].toLowerCase(),
        token0Id: result.value.token0.toLowerCase(),
        token1Id: result.value.token1.toLowerCase(),
        liquidity: '0',
        fee: result.value.fee,
        tickLower: result.value.tickLower,
        tickUpper: result.value.tickUpper,
        depositedToken0: '0',
        depositedToken1: '0',
        owner: owner.toLowerCase(),
        isActive: 'false',
        isTracked: 'false',
        lastUpdatedBlockTs: 0,
        lastUpdatedBlockHeight: 0,
        poolId: '',
      });
    }
  }

  const poolIds = await multicall.aggregate(
    factoryAbi.functions.getPool,
    FACTORY_ADDRESS,
    positions.map((p) => {
      return {
        tokenA: p.token0Id,
        tokenB: p.token1Id,
        fee: p.fee,
      };
    }),
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < positions.length; i++) {
    positions[i].poolId = poolIds[i].toLowerCase();
  }
  console.log('returning positions', positions);
  return positions;
}

// async function updateFeeVars(ctx: BlockHandlerContext<Store>, positions: Position[]) {
//   const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

//   const positionResult = await multicall.tryAggregate(
//     positionsAbi.functions.positions,
//     POSITIONS_ADDRESS,
//     positions.map((p) => {
//       return { tokenId: BigInt(p.id) };
//     }),
//     MULTICALL_PAGE_SIZE,
//   );

//   for (let i = 0; i < positions.length; i++) {
//     const result = positionResult[i];
//     if (result.success) {
//       positions[i].feeGrowthInside0LastX128 = result.value.feeGrowthInside0LastX128;
//       positions[i].feeGrowthInside1LastX128 = result.value.feeGrowthInside1LastX128;
//     }
//   }
// }
interface IncreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  transactionHash: string;
}

function processInreaseLiquidity(log: EvmLog): IncreaseData {
  const { tokenId, amount0, amount1, liquidity } =
    positionsAbi.events.IncreaseLiquidity.decode(log);

  return {
    tokenId: tokenId.toString(),
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    transactionHash: log.transactionHash,
  };
}

interface DecreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  transactionHash: string;
}

function processDecreaseLiquidity(log: EvmLog): DecreaseData {
  const event = positionsAbi.events.DecreaseLiquidity.decode(log);

  return {
    tokenId: event.tokenId.toString(),
    amount0: event.amount0,
    amount1: event.amount1,
    liquidity: event.liquidity,
    transactionHash: log.transactionHash,
  };
}

interface TransferData {
  tokenId: string;
  to: string;
  transactionHash: string;
}

function processTransfer(log: EvmLog): TransferData {
  const { tokenId, to } = positionsAbi.events.Transfer.decode(log);
  return {
    tokenId: tokenId.toString(),
    to: to.toLowerCase(),
    transactionHash: log.transactionHash,
  };
}
