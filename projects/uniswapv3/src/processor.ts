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

const env = validateEnv();

const uniswapV3DexProtocol = env.univ3Protocols[0];
const poolAddresses = uniswapV3DexProtocol.pools.map((pool) => pool.contractAddress);
const earliestFromBlock = Math.min(...uniswapV3DexProtocol.pools.map((pool) => pool.fromBlock));

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint({
    url: uniswapV3DexProtocol.rpcUrl,
    maxBatchCallSize: 25,
  })
  .setGateway(uniswapV3DexProtocol.gatewayUrl)
  .setFinalityConfirmation(75)
  .addLog({
    address: [uniswapV3DexProtocol.factoryAddress],
    topic0: [factoryAbi.events.PoolCreated.topic],
    transaction: true,
    range: {
      from: uniswapV3DexProtocol.factoryDeployedAt,
      ...(uniswapV3DexProtocol.toBlock > 0 && { to: uniswapV3DexProtocol.toBlock }),
    },
  })
  .addLog({
    address: poolAddresses,
    topic0: [
      poolAbi.events.Burn.topic,
      poolAbi.events.Mint.topic,
      poolAbi.events.Initialize.topic,
      poolAbi.events.Swap.topic,
    ],
    range: {
      from: earliestFromBlock,
      ...(uniswapV3DexProtocol.toBlock > 0 && { to: uniswapV3DexProtocol.toBlock }),
    },
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
    range: {
      from: earliestFromBlock,
      ...(uniswapV3DexProtocol.toBlock > 0 && { to: uniswapV3DexProtocol.toBlock }),
    },
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
