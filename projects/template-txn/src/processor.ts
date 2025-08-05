// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as vusdMintAbi from './abi/mint';
import { TxnTrackingProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();
const vusdMintBondingCurveProtocol = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.VUSD_MINT;
});

if (!vusdMintBondingCurveProtocol) {
  throw new Error('VUSDMint protocol not found');
}

const earliestFromBlock = vusdMintBondingCurveProtocol.fromBlock;
export const processor = new EvmBatchProcessor()
  .setGateway(vusdMintBondingCurveProtocol.gatewayUrl)
  .setRpcEndpoint(vusdMintBondingCurveProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(vusdMintBondingCurveProtocol.toBlock != 0
      ? { to: Number(vusdMintBondingCurveProtocol.toBlock) }
      : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [vusdMintBondingCurveProtocol.contractAddress],
    topic0: [vusdMintAbi.events.Mint.topic],
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
