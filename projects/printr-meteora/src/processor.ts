import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import { validateEnv } from './utils/validateEnv';
import * as printrAbi from './abi/diRTqkRxqg9fvQXemGosY8hg91Q7DpFqGXLJwG3bEDA';
const env = validateEnv();
const { printrMeteoraProtocol } = env;

export const processor = new DataSourceBuilder()
  .setGateway(printrMeteoraProtocol.gatewayUrl)
  .setRpc(
    printrMeteoraProtocol.rpcUrl == null
      ? undefined
      : {
          client: new SolanaRpcClient({
            url: printrMeteoraProtocol.rpcUrl,
            // rateLimit: 100 // requests per sec
          }),
          strideConcurrency: 10,
        },
  )
  .setBlockRange({ from: printrMeteoraProtocol.fromBlock })
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
      programId: [printrAbi.programId], // where executed by Whirlpool program
      d8: [printrAbi.instructions.swap.d8],

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
