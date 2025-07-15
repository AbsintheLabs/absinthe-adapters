// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as hemiAbi from './abi/hemi';
import { StakingProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();

const hemiStakingProtocol = env.stakingProtocols.find((stakingProtocol) => {
  return stakingProtocol.type === StakingProtocol.HEMI;
});

if (!hemiStakingProtocol) {
  throw new Error('Hemi staking protocol not found');
}

const contractAddresses = hemiStakingProtocol.contractAddress;
const earliestFromBlock = hemiStakingProtocol.fromBlock;

export const processor = new EvmBatchProcessor()
  // .setGateway(hemiStakingProtocol.gatewayUrl)
  .setRpcEndpoint(hemiStakingProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(hemiStakingProtocol.toBlock !== 0 ? { to: Number(hemiStakingProtocol.toBlock) } : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [contractAddresses],
    topic0: [hemiAbi.events.Deposit.topic, hemiAbi.events.Withdraw.topic],
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
