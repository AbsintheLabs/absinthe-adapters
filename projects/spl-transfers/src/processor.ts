import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import { startBlock } from './utils/conts';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

export const processor = new DataSourceBuilder()
  .setGateway('https://v2.archive.subsquid.io/network/solana-mainnet')
  .setRpc(
    process.env.SOLANA_NODE == null
      ? undefined
      : {
          client: new SolanaRpcClient({
            url: process.env.SOLANA_NODE,
            // rateLimit: 100 // requests per sec
          }),
          strideConcurrency: 10,
        },
  )
  .setBlockRange({ from: startBlock })
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
      programId: [tokenProgram.programId], // where executed by Whirlpool program
      d1: [tokenProgram.instructions.transfer.d1], // have first 8 bytes of .data equal to swap descriptor
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
