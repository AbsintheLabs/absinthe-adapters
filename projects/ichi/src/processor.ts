// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
  BlockHeader,
  BlockData,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as hemiAbi from './abi/hemi';
import * as ichiAbi from './abi/ichi';
import * as demosAbi from './abi/demos';
import { StakingProtocol, validateEnv } from '@absinthe/common';

// const env = validateEnv();

// const hemiStakingProtocol = env.stakingProtocols.find((stakingProtocol) => {
//   return stakingProtocol.type === StakingProtocol.HEMI;
// });

// if (!hemiStakingProtocol) {
//   throw new Error('Hemi staking protocol not found');
// }

// const contractAddresses = hemiStakingProtocol.contractAddress;
// const earliestFromBlock = hemiStakingProtocol.fromBlock;

// PARAMS
// todo: SET BLOCK RANGES AND CONRACT ADDRESS!
// TEST NUM 2 - DEMOS

const fromBlock = 1931630;
export const toBlock = 2481775;
const contractAddresses = '0x70468f06cf32b776130e2da4c0d7dd08983282ec';

// const fromBlock = 1685017;
// // export const toBlock = 2481775;
// export const toBlock = 1800000;
// // const contractAddresses = '0xa18a0fC8bF43A18227742B4bf8F2813b467804c6';
// // const contractAddresses = '0xDb7608614dfdD9feBFC1b82A7609420fa7B3Bc34'
// const contractAddresses = [
//   '0xa18a0fC8bF43A18227742B4bf8F2813b467804c6',
//   '0x983Ef679f2913C0FA447DD7518404b7D07198291',
//   '0x423Fc440A2b61fc1e81ECc406fdF70d36929C680',
//   '0xF399dafCB98f958474E736147d9D35b2A3caE3e0',
// ];
// END PARAMS
// 1931630, 1931606, 1685020, 1685017

// temporary to make this work:
const hemiStakingProtocol = {
  gatewayUrl: 'https://v2.archive.subsquid.io/network/hemi-mainnet',
  rpcUrl: 'https://rpc.hemi.network/rpc',
  toBlock, // note: we are tracking a very small range for testing
  // toBlock: 0,
};

const earliestFromBlock = fromBlock;
// const earliestFromBlock = 1434250;

export const processor = new EvmBatchProcessor()
  .setGateway(hemiStakingProtocol.gatewayUrl)
  .setRpcEndpoint(hemiStakingProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(hemiStakingProtocol.toBlock && hemiStakingProtocol.toBlock !== 0
      ? { to: Number(hemiStakingProtocol.toBlock) }
      : {}),
  })
  .includeAllBlocks()
  .setFinalityConfirmation(75)
  .addTransaction({
    sighash: [demosAbi.functions.userVerify.sighash],
    to: [contractAddresses],
  })
  // .addLog({
  //   // todo: SET CONTRACT ADDRESS + TOPIC0
  //   address: [...contractAddresses],
  //   // topic0: [hemiAbi.events.Deposit.topic, hemiAbi.events.Withdraw.topic],
  //   topic0: [ichiAbi.events.Transfer.topic],
  //   transaction: true,
  // })
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
      status: true,
    },
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockData<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<S> = DataHandlerContext<S, Fields>;
