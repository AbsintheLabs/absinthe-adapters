import fs from 'fs';
import { FACTORY_ADDRESS, FACTORY_DEPLOYED_AT, POSITIONS_ADDRESS } from './utils/constants';
import { assertNotNull } from '@subsquid/util-internal';

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';

import * as factoryAbi from './abi/factory';
import * as poolAbi from './abi/pool';
import * as positionsAbi from './abi/NonfungiblePositionManager';

const poolsMetadata = JSON.parse(fs.readFileSync('./assets/pools.json', 'utf-8')) as {
  height: number;
  pools: string[];
};

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint('https://eth-mainnet.g.alchemy.com/v2/6666666666666666666666666666666666666666')
  .setGateway(vusdBridgeProtocol.gatewayUrl)
  .setBlockRange({
    from: FACTORY_DEPLOYED_AT,
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [FACTORY_ADDRESS],
    topic0: [factoryAbi.events.PoolCreated.topic],
    transaction: true,
  })
  .addLog({
    address: poolsMetadata.pools,
    topic0: [
      poolAbi.events.Burn.topic,
      poolAbi.events.Mint.topic,
      poolAbi.events.Initialize.topic,
      poolAbi.events.Swap.topic,
    ],
    range: { from: FACTORY_DEPLOYED_AT, to: poolsMetadata.height },
    transaction: true,
  })
  .addLog({
    topic0: [
      poolAbi.events.Burn.topic,
      poolAbi.events.Mint.topic,
      poolAbi.events.Initialize.topic,
      poolAbi.events.Swap.topic,
    ],
    range: { from: poolsMetadata.height + 1 },
    transaction: true,
  })
  .addLog({
    address: [POSITIONS_ADDRESS],
    topic0: [
      positionsAbi.events.IncreaseLiquidity.topic,
      positionsAbi.events.DecreaseLiquidity.topic,
      positionsAbi.events.Collect.topic,
      positionsAbi.events.Transfer.topic,
    ],
    transaction: true,
  })
  .setFields({
    transaction: {
      from: true,
      value: true,
      hash: true,
      gasUsed: true,
      gasPrice: true,
    },
    log: {
      topics: true,
      data: true,
    },
  })
  .setBlockRange({
    from: FACTORY_DEPLOYED_AT,
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
