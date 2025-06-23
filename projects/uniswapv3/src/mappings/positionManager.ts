import { BigDecimal } from '@subsquid/big-decimal';

import {
  BlockHandlerContext,
  CommonHandlerContext,
  BlockHeader,
} from '../utils/interfaces/interfaces';

import { Multicall } from '../abi/multicall';
import { Position, PositionSnapshot, Token } from '../model';
import { BlockMap } from '../utils/blockMap';
import {
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
  POSITIONS_ADDRESS,
} from '../utils/constants';
import { EntityManager } from '../utils/entityManager';
import { last } from '../utils/tools';
import * as factoryAbi from './../abi/factory';
import * as positionsAbi from './../abi/NonfungiblePositionManager';
import { BlockData, DataHandlerContext } from '@subsquid/evm-processor';
import { EvmLog } from '@subsquid/evm-processor/src/interfaces/evm';
import { Store } from '@subsquid/typeorm-store';

type EventData =
  | (TransferData & { type: 'Transfer' })
  | (IncreaseData & { type: 'Increase' })
  | (DecreaseData & { type: 'Decrease' });

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

export async function processPositions(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
): Promise<void> {
  const eventsData = processItems(ctx, blocks);
  if (!eventsData || eventsData.size == 0) return;

  await prefetch(ctx, eventsData, last(blocks).header);

  for (const [block, blockEventsData] of eventsData) {
    for (const data of blockEventsData) {
      switch (data.type) {
        case 'Increase':
          await processIncreaseData(ctx, block, data);
          break;
        case 'Decrease':
          await processDecreaseData(ctx, block, data);
          break;
        case 'Transfer':
          await processTransferData(ctx, block, data);
          break;
      }
    }
  }

  // await updateFeeVars(createContext(last(blocks).header), ctx.entities.values(Position))
}

//todo: review removed defer and load steps from here
//todo: remove memory traces from business logic
async function prefetch(
  ctx: ContextWithEntityManager,
  eventsData: BlockMap<EventData>,
  block: BlockHeader,
) {
  const positionIds = new Set<string>();
  for (const [, blockEventsData] of eventsData) {
    for (const data of blockEventsData) {
      //don't add in defferedIds if its in cache already.
      // ctx.entities.defer(Position, data.tokenId);
      positionIds.add(data.tokenId);
    }
  }
  const positions = await initPositions({ ...ctx, block }, Array.from(positionIds));
  for (const position of positions) {
    ctx.entities.add(position);
  }

  for (const position of ctx.entities.values(Position)) {
    ctx.entities.defer(Token, position.token0Id, position.token1Id);
  }

  await ctx.entities.load(Token);
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
) {
  //todo: fail if ttl
  let position = ctx.entities.get(Position, data.tokenId, false);
  if (position == null) return;

  let token0 = await ctx.entities.get(Token, position.token0Id);
  let token1 = await ctx.entities.get(Token, position.token1Id);

  if (!token0 || !token1) return;

  let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  position.liquidity = position.liquidity + data.liquidity;
  position.depositedToken0 = position.depositedToken0 + amount0;
  position.depositedToken1 = position.depositedToken1 + amount1;

  updatePositionSnapshot(ctx, block, position.id);
}

async function processDecreaseData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: DecreaseData,
) {
  // temp fix - todo: look on
  if (block.height == 14317993) return;

  let position = ctx.entities.get(Position, data.tokenId, false);
  if (position == null) return;

  let token0 = await ctx.entities.get(Token, position.token0Id);
  let token1 = await ctx.entities.get(Token, position.token1Id);

  if (!token0 || !token1) return;

  let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  position.liquidity = position.liquidity - data.liquidity;
  position.withdrawnToken0 = position.withdrawnToken0 + amount0;
  position.withdrawnToken1 = position.withdrawnToken1 + amount1;

  updatePositionSnapshot(ctx, block, position.id);
}

async function processTransferData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: TransferData,
) {
  let position = ctx.entities.get(Position, data.tokenId, false);

  // position was not able to be fetched
  if (position == null) return;

  position.owner = data.to;

  updatePositionSnapshot(ctx, block, position.id);
}

//todo: send this to s3
//todo: everytime it should just be a seperate object
//todo: this is not stored in db
async function updatePositionSnapshot(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  positionId: string,
) {
  const position = ctx.entities.getOrFail(Position, positionId, false);

  const positionBlockId = snapshotId(positionId, block.height);

  let positionSnapshot = ctx.entities.get(PositionSnapshot, positionBlockId, false);
  if (!positionSnapshot) {
    positionSnapshot = new PositionSnapshot({ id: positionBlockId });
    ctx.entities.add(positionSnapshot);
  }
  positionSnapshot.owner = position.owner;
  positionSnapshot.pool = position.pool;
  positionSnapshot.positionId = positionId;
  positionSnapshot.blockNumber = block.height;
  positionSnapshot.timestamp = new Date(block.timestamp);
  positionSnapshot.liquidity = position.liquidity;
  positionSnapshot.depositedToken0 = position.depositedToken0;
  positionSnapshot.depositedToken1 = position.depositedToken1;
  positionSnapshot.withdrawnToken0 = position.withdrawnToken0;
  positionSnapshot.withdrawnToken1 = position.withdrawnToken1;
  positionSnapshot.collectedFeesToken0 = position.collectedFeesToken0;
  positionSnapshot.collectedFeesToken1 = position.collectedFeesToken1;
  return;
}

function createPosition(positionId: string) {
  const position = new Position({ id: positionId });

  position.owner = ADDRESS_ZERO;
  position.liquidity = 0n;
  position.depositedToken0 = 0;
  position.depositedToken1 = 0;
  position.withdrawnToken0 = 0;
  position.withdrawnToken1 = 0;
  position.collectedFeesToken0 = 0;
  position.collectedFeesToken1 = 0;
  position.feeGrowthInside0LastX128 = 0n;
  position.feeGrowthInside1LastX128 = 0n;

  return position;
}

//todo: improve code
async function initPositions(ctx: BlockHandlerContext<Store>, ids: string[]) {
  const positions: Position[] = [];
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const positionResults = await multicall.tryAggregate(
    positionsAbi.functions.positions,
    POSITIONS_ADDRESS,
    ids.map((id) => {
      return { tokenId: BigInt(id) };
    }),
    MULTICALL_PAGE_SIZE,
  );

  const positionsData: {
    positionId: string;
    token0Id: string;
    token1Id: string;
    fee: number;
  }[] = [];

  for (let i = 0; i < ids.length; i++) {
    const result = positionResults[i];
    if (result.success) {
      positionsData.push({
        positionId: ids[i].toLowerCase(),
        token0Id: result.value.token0.toLowerCase(),
        token1Id: result.value.token1.toLowerCase(),
        fee: result.value.fee,
      });
    }
  }

  const poolIds = await multicall.aggregate(
    factoryAbi.functions.getPool,
    FACTORY_ADDRESS,
    positionsData.map((p) => {
      return {
        tokenA: p.token0Id,
        tokenB: p.token1Id,
        fee: p.fee,
      };
    }),
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < positionsData.length; i++) {
    const position = createPosition(positionsData[i].positionId);
    position.token0Id = positionsData[i].token0Id;
    position.token1Id = positionsData[i].token1Id;
    position.poolId = poolIds[i].toLowerCase();

    // temp fix - todo: remove this
    if (position.poolId === '0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248') continue;

    positions.push(position);
  }

  return positions;
}

async function updateFeeVars(ctx: BlockHandlerContext<Store>, positions: Position[]) {
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const positionResult = await multicall.tryAggregate(
    positionsAbi.functions.positions,
    POSITIONS_ADDRESS,
    positions.map((p) => {
      return { tokenId: BigInt(p.id) };
    }),
    MULTICALL_PAGE_SIZE,
  );

  for (let i = 0; i < positions.length; i++) {
    const result = positionResult[i];
    if (result.success) {
      positions[i].feeGrowthInside0LastX128 = result.value.feeGrowthInside0LastX128;
      positions[i].feeGrowthInside1LastX128 = result.value.feeGrowthInside1LastX128;
    }
  }
}

function snapshotId(positionId: string, block: number) {
  return `${positionId}#${block}`;
}

//tokenId -> positionId
interface IncreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
}

function processInreaseLiquidity(log: EvmLog): IncreaseData {
  const { tokenId, amount0, amount1, liquidity } =
    positionsAbi.events.IncreaseLiquidity.decode(log);

  return {
    tokenId: tokenId.toString(),
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
  };
}

interface DecreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
}

function processDecreaseLiquidity(log: EvmLog): DecreaseData {
  const event = positionsAbi.events.DecreaseLiquidity.decode(log);

  return {
    tokenId: event.tokenId.toString(),
    amount0: event.amount0,
    amount1: event.amount1,
    liquidity: event.liquidity,
  };
}

interface TransferData {
  tokenId: string;
  to: string;
}

function processTransfer(log: EvmLog): TransferData {
  const { tokenId, to } = positionsAbi.events.Transfer.decode(log);
  //todo: breaks twb
  return {
    tokenId: tokenId.toString(),
    to: to.toLowerCase(),
  };
}
