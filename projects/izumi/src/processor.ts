// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

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
import { ProtocolType, validateEnv } from '@absinthe/common';

const env = validateEnv();

const izumiDexProtocol = env.dexProtocols.find((dexProtocol) => {
  return dexProtocol.type === ProtocolType.IZUMI;
});

if (!izumiDexProtocol) {
  throw new Error('Izumi protocol not found');
}

const contractAddresses = izumiDexProtocol.protocols.map((protocol) => protocol.contractAddress);
const earliestFromBlock = Math.min(
  ...izumiDexProtocol.protocols.map((protocol) => protocol.fromBlock),
);
export const processor = new EvmBatchProcessor()
  .setGateway(izumiDexProtocol.gatewayUrl)
  .setRpcEndpoint(izumiDexProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(izumiDexProtocol.toBlock !== 0 ? { to: Number(izumiDexProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: contractAddresses,
    topic0: [
      factoryAbi.events.NewPool.topic,
      poolAbi.events.Mint.topic,
      poolAbi.events.Burn.topic,
      poolAbi.events.Swap.topic,
    ],
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
