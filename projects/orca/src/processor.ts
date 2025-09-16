import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import * as whirlpoolProgram from './abi/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
import { validateEnv } from './utils/validateEnv';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import { WHIRLPOOL_ADDRESSES, TOKEN_EXTENSION_PROGRAM_ID } from './utils/consts';
const env = validateEnv();
const { orcaProtocol } = env;

export const processor = new DataSourceBuilder()
  .setGateway(orcaProtocol.gatewayUrl)
  .setRpc(
    orcaProtocol.rpcUrl == null
      ? undefined
      : {
          client: new SolanaRpcClient({
            url: orcaProtocol.rpcUrl,
            // rateLimit: 100 // requests per sec
          }),
          strideConcurrency: 10,
        },
  )
  .setBlockRange({ from: orcaProtocol.fromBlock })
  .setFields({
    block: {
      // block header fields
      timestamp: true,
    },
    transaction: {
      // transaction fields
      signatures: true,
    },
    instruction: {
      // instruction fields
      programId: true,
      accounts: true,
      data: true,
    },
    tokenBalance: {
      // token balance record fields
      preAmount: true,
      postAmount: true,
      preOwner: true,
      postOwner: true,
    },
  })
  .addInstruction({
    // select instructions, that:
    where: {
      programId: [whirlpoolProgram.programId], // where executed by Whirlpool program
      d8: [
        whirlpoolProgram.instructions.swap.d8,
        whirlpoolProgram.instructions.swapV2.d8,
        whirlpoolProgram.instructions.twoHopSwapV2.d8,
        whirlpoolProgram.instructions.twoHopSwap.d8,

        // whirlpoolProgram.instructions.increaseLiquidity.d8,
        // whirlpoolProgram.instructions.decreaseLiquidity.d8,
        // whirlpoolProgram.instructions.decreaseLiquidityV2.d8,
        // whirlpoolProgram.instructions.increaseLiquidityV2.d8,

        //todo: add fee instructions in future
        // whirlpoolProgram.instructions.collectFees.d8,
        // whirlpoolProgram.instructions.collectFeesV2.d8,
        // whirlpoolProgram.instructions.collectReward.d8,
        // whirlpoolProgram.instructions.collectRewardV2.d8,
        // whirlpoolProgram.instructions.collectProtocolFeesV2.d8,
        // whirlpoolProgram.instructions.collectProtocolFees.d8,

        whirlpoolProgram.instructions.openPosition.d8,
        whirlpoolProgram.instructions.closePosition.d8,
        whirlpoolProgram.instructions.openPositionWithTokenExtensions.d8,
        whirlpoolProgram.instructions.closePositionWithTokenExtensions.d8,
        whirlpoolProgram.instructions.openPositionWithMetadata.d8,

        whirlpoolProgram.instructions.openBundledPosition.d8,
        whirlpoolProgram.instructions.closeBundledPosition.d8,
        whirlpoolProgram.instructions.initializePositionBundle.d8,
        whirlpoolProgram.instructions.initializePositionBundleWithMetadata.d8,
        whirlpoolProgram.instructions.deletePositionBundle.d8,

        whirlpoolProgram.instructions.initializePoolV2.d8,
        whirlpoolProgram.instructions.initializePool.d8,
        whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.d8,

        // whirlpoolProgram.instructions.lockPosition.d8,
        // whirlpoolProgram.instructions.resetPositionRange.d8,
        // whirlpoolProgram.instructions.transferLockedPosition.d8,
      ],

      //note: not including closePosition as it wouldn't work.
      // Why =>  because we already have the respective positions for the specific pool stored, and when there would be a closePosition for lets say a position that doesn't exists, we wouldn't do anything.
      isCommitted: true, // where successfully committed
    },
    // for each instruction selected above
    // make sure to also include:
    include: {
      innerInstructions: true, // inner instructions
      transaction: true, // transaction, that executed the given instruction
      transactionTokenBalances: true, // all token balance records of executed transaction
    },
  })
  .addInstruction({
    where: {
      programId: [tokenProgram.programId, TOKEN_EXTENSION_PROGRAM_ID],
      d1: [tokenProgram.instructions.transferChecked.d1],
      isCommitted: true,
    },
    include: {
      innerInstructions: true,
      transaction: true,
      transactionTokenBalances: true,
    },
  })
  .build();
