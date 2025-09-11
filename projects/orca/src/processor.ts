import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import * as whirlpoolProgram from './abi/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
import { validateEnv } from './utils/validateEnv';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import * as tokenProgram2022 from './abi/TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
import { WHIRLPOOL_ADDRESSES } from './utils/consts';
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
      programId: [whirlpoolProgram.programId, tokenProgram.programId, tokenProgram2022.programId], // where executed by Whirlpool program
      d8: [
        whirlpoolProgram.instructions.swap.d8,
        whirlpoolProgram.instructions.swapV2.d8,
        whirlpoolProgram.instructions.twoHopSwapV2.d8,
        whirlpoolProgram.instructions.twoHopSwap.d8,

        whirlpoolProgram.instructions.increaseLiquidity.d8,
        whirlpoolProgram.instructions.decreaseLiquidity.d8,
        whirlpoolProgram.instructions.decreaseLiquidityV2.d8,
        whirlpoolProgram.instructions.increaseLiquidityV2.d8,

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

        whirlpoolProgram.instructions.lockPosition.d8,
        whirlpoolProgram.instructions.resetPositionRange.d8,
        whirlpoolProgram.instructions.transferLockedPosition.d8,
      ],
      d1: [tokenProgram.instructions.transferChecked.d1],

      // ...whirlpoolProgram.instructions.swap.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.swapV2.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),

      // //NOTE: This will capture all two-hop swaps that start with the USDC-SOL pool, regardless of where they go next. This gives you a good view of all swaps involving that specific pool as the first hop.
      // ...whirlpoolProgram.instructions.twoHopSwapV2.accountSelection({
      //   whirlpoolOne: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.twoHopSwap.accountSelection({
      //   whirlpoolOne: WHIRLPOOL_ADDRESSES,
      // }),

      // ...whirlpoolProgram.instructions.increaseLiquidity.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.decreaseLiquidity.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.decreaseLiquidityV2.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.increaseLiquidityV2.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.initializePoolV2.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.initializePool.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.openPosition.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.openPositionWithTokenExtensions.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
      // ...whirlpoolProgram.instructions.openPositionWithMetadata.accountSelection({
      //   whirlpool: WHIRLPOOL_ADDRESSES,
      // }),
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
  .build();

//335147643
// ABS_CONFIG='{"balanceFlushIntervalHours":48,"type":"orca","name":"orca","toBlock":0,"contractAddress":"whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc","chainId":1000,"fromBlock":335147643}'
