// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as vusdAbi from './abi/vusd';
import { StakingProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();

const vusdBridgeProtocol = env.stakingProtocols.find((vusdBridgeProtocol) => {
  return vusdBridgeProtocol.type === StakingProtocol.VUSDBRIDGE;
});

if (!vusdBridgeProtocol) {
  throw new Error('VUSDBridge protocol not found');
}

const contractAddresses = vusdBridgeProtocol.contractAddress;
const earliestFromBlock = vusdBridgeProtocol.fromBlock;

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint(vusdBridgeProtocol.rpcUrl)
  .setGateway(vusdBridgeProtocol.gatewayUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(vusdBridgeProtocol.toBlock !== 0 ? { to: Number(vusdBridgeProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [contractAddresses],
    topic0: [vusdAbi.events.ERC20BridgeFinalized.topic],
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
