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

// const fromBlock = 1931630;
// export const toBlock = 2481775;
// const contractAddresses = '0x70468f06cf32b776130e2da4c0d7dd08983282ec';

const fromBlock = 1729013;
export const toBlock = 2481775;
// export const toBlock = 1800000;
// const contractAddresses = '0xa18a0fC8bF43A18227742B4bf8F2813b467804c6';
// const contractAddresses = '0xDb7608614dfdD9feBFC1b82A7609420fa7B3Bc34'
// ichi addresses
// const contractAddresses = [
//   '0xa18a0fC8bF43A18227742B4bf8F2813b467804c6',
//   '0x983Ef679f2913C0FA447DD7518404b7D07198291',
//   '0x423Fc440A2b61fc1e81ECc406fdF70d36929C680',
//   '0xF399dafCB98f958474E736147d9D35b2A3caE3e0',
// ];

// gamma addresses
const contractAddresses = [
  '0xd317b3bc6650fc6c128b672a12ae22e66027185f',
  '0x7eccd6d077e4ad7120150578e936a22f058fbcce',
  '0xdb7608614dfdd9febfc1b82a7609420fa7b3bc34',
];
// END PARAMS

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
  // .addTransaction({
  //   sighash: [demosAbi.functions.userVerify.sighash],
  //   to: [contractAddresses],
  // })
  .addLog({
    // todo: SET CONTRACT ADDRESS + TOPIC0
    address: [...contractAddresses],
    // topic0 will be set by adapter via buildProcessor
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
      status: true,
    },
  });

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockData<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<S> = DataHandlerContext<S, Fields>;
