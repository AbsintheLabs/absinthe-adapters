import {
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
  BlockHeader,
  DataHandlerContext,
} from '@subsquid/evm-processor';
import * as mainAbi from './abi/main';
import { ZebuClientConfigWithChain } from '@absinthe/common';

export function createProcessor(clients: ZebuClientConfigWithChain[]) {
  const contractAddresses = clients.map((client) => client.contractAddress);
  const fromBlock = Math.min(...clients.map((client) => client.fromBlock));

  return new EvmBatchProcessor()
    .setGateway(clients[0].gatewayUrl)
    .setRpcEndpoint(clients[0].rpcUrl)
    .setBlockRange({
      from: fromBlock,
    })
    .setFinalityConfirmation(75)
    .addLog({
      address: contractAddresses,
      topic0: [mainAbi.events.AuctionBid_Placed.topic, mainAbi.events.Auction_Claimed.topic],
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
}

export type Fields = EvmBatchProcessorFields<ReturnType<typeof createProcessor>>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
