import fs from 'fs';

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
import { validateEnv } from '@absinthe/common';

const poolsMetadata = JSON.parse(fs.readFileSync('./assets/pools.json', 'utf-8')) as {
  height: number;
  pools: string[];
};

const env = validateEnv();

const uniswapV3DexProtocol = env.univ3Protocols[0];

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint(uniswapV3DexProtocol.rpcUrl)
  .setGateway(uniswapV3DexProtocol.gatewayUrl)
  .setBlockRange({
    from: uniswapV3DexProtocol.factoryDeployedAt,
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [uniswapV3DexProtocol.factoryAddress],
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
    range: { from: uniswapV3DexProtocol.factoryDeployedAt, to: poolsMetadata.height },
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
    address: [uniswapV3DexProtocol.positionsAddress],
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
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
