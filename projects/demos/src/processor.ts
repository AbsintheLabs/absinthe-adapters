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
import { FUNCTION_SELECTOR } from './utils/consts';

const env = validateEnv();

const demosProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.DEMOS;
});

if (!demosProtocol) {
  throw new Error('Demos protocol not found');
}

const contractAddresses = demosProtocol.contractAddress;
const earliestFromBlock = demosProtocol.fromBlock;

export const processor = new EvmBatchProcessor()
  .setRpcEndpoint(demosProtocol.rpcUrl)
  .setGateway('https://v2.archive.subsquid.io/network/hemi-mainnet')
  .setBlockRange({
    from: earliestFromBlock,
    ...(demosProtocol.toBlock !== 0 ? { to: Number(demosProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addTransaction({
    sighash: [FUNCTION_SELECTOR],
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
