// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as morphoFactoryAbi from './abi/morphofactoryv1';
import * as morphoAbi from './abi/morphov1';
import { StakingProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();

const morphoStakingProtocol = env.stakingProtocols.find((stakingProtocol) => {
  return stakingProtocol.type === StakingProtocol.MORPHO;
});

if (!morphoStakingProtocol) {
  throw new Error('Morpho staking protocol not found');
}

const contractAddresses = morphoStakingProtocol.contractAddress;
const earliestFromBlock = morphoStakingProtocol.fromBlock;

export const processor = new EvmBatchProcessor()
  .setGateway(morphoStakingProtocol.gatewayUrl)
  .setRpcEndpoint(morphoStakingProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(morphoStakingProtocol.toBlock !== 0 ? { to: Number(morphoStakingProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [contractAddresses],
    topic0: [
      morphoAbi.events.Supply.topic,
      morphoAbi.events.Borrow.topic,
      morphoAbi.events.Repay.topic,
      morphoAbi.events.Withdraw.topic,
      morphoAbi.events.CreateMarket.topic,
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
