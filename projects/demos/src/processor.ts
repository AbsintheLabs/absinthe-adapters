// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import { BondingCurveProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();

const demosProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.DEMOS;
});

if (!demosProtocol) {
  throw new Error('Demos protocol not found');
}

const contractAddresses = demosProtocol.contractAddress;
const earliestFromBlock = demosProtocol.fromBlock;

//todo: add this in the config file
const functionSelector = '0xa4760a9e';

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint(demosProtocol.rpcUrl)
  // .setGateway(vusdBridgeProtocol.gatewayUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(demosProtocol.toBlock !== 0 ? { to: Number(demosProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addTransaction({
    sighash: [functionSelector],
    to: [contractAddresses],
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
      input: true,
    },
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
