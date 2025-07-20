import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor';
import * as printrAbi from './abi/printr';
import * as poolAbi from './abi/pool';
import { BondingCurveProtocol, validateEnv } from '@absinthe/common';

const env = validateEnv();
const printrBondingCurveProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.PRINTR;
});

if (!printrBondingCurveProtocol) {
  throw new Error('Printr protocol not found');
}

const earliestFromBlock = printrBondingCurveProtocol.fromBlock;
export const processor = new EvmBatchProcessor()
  .setGateway(printrBondingCurveProtocol.gatewayUrl)
  .setRpcEndpoint(printrBondingCurveProtocol.rpcUrl)
  .setBlockRange({
    from: earliestFromBlock,
    ...(printrBondingCurveProtocol.toBlock != 0
      ? { to: Number(printrBondingCurveProtocol.toBlock) }
      : {}),
  })
  .setFinalityConfirmation(75)
  .addLog({
    address: [printrBondingCurveProtocol.contractAddress],
    topic0: [
      printrAbi.events.CurveCreated.topic,
      printrAbi.events.TokenTrade.topic,
      printrAbi.events.LiquidityDeployed.topic,
    ],
    transaction: true,
  })

  .addLog({
    topic0: [poolAbi.events.Swap.topic],
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
