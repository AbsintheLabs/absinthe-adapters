// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as univ2Abi from './abi/univ2';
import { ProtocolType, validateEnv } from '@absinthe/common';

const env = validateEnv();

const uniswapV2DexProtocol = env.dexProtocols.find((dexProtocol) => {
  return dexProtocol.type === ProtocolType.UNISWAP_V2;
});

if (!uniswapV2DexProtocol) {
  throw new Error('Uniswap V2 protocol not found');
}

const contractAddresses = uniswapV2DexProtocol.protocols.map(
  (protocol) => protocol.contractAddress,
);
const earliestFromBlock = Math.min(
  ...uniswapV2DexProtocol.protocols.map((protocol) => protocol.fromBlock),
);
export const processor = new EvmBatchProcessor()
  .setGateway(uniswapV2DexProtocol.gatewayUrl)
  .setRpcEndpoint(uniswapV2DexProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(uniswapV2DexProtocol.toBlock !== 0 ? { to: Number(uniswapV2DexProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: contractAddresses,
    topic0: [univ2Abi.events.Transfer.topic, univ2Abi.events.Swap.topic],
    transaction: true,
  })
  .setFields({
    log: {
      transactionHash: true,
    },
    transaction: {
      to: true,
      from: true,
      gas: true,
      gasPrice: true,
      gasUsed: true,
    },
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
