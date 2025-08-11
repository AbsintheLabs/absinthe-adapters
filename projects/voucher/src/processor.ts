// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as erc20Abi from './abi/erc20';
import { TxnTrackingProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();

const voucher = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.VOUCHER;
});

if (!voucher) {
  throw new Error('Voucher protocol not found');
}

const contractAddresses = voucher.contractAddress;

export const processor = new EvmBatchProcessor()
  .setGateway(voucher.gatewayUrl)
  .setRpcEndpoint(voucher.rpcUrl)
  .setBlockRange({
    from: voucher.fromBlock,
    ...(voucher.toBlock !== 0 ? { to: Number(voucher.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [contractAddresses],
    topic0: [erc20Abi.events.Transfer.topic],
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
