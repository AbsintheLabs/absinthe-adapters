// processor/build.ts
import {
  BlockData,
  Log as _Log,
  Transaction as _Transaction,
  EvmBatchProcessorFields,
  EvmBatchProcessor,
  DataHandlerContext,
} from '@subsquid/evm-processor';
// import { SolanaBatchProcessor } from '@subsquid/solana-processor';
import type { AppConfig } from './config/schema.ts';
import { Database } from '@subsquid/file-store';

// Generic processor type that can handle both EVM and Solana
export type BaseProcessor = EvmBatchProcessor;
// export type BaseProcessor = EvmBatchProcessor | SolanaBatchProcessor; // Future: support both

export function buildBaseSqdProcessor(cfg: AppConfig) {
  const p = new EvmBatchProcessor();

  if (cfg.network.gatewayUrl) {
    p.setGateway(cfg.network.gatewayUrl);
    p.setRpcDataIngestionSettings({
      disabled: true,
    });
  } else {
    // Enable RPC data ingestion when no gateway is provided
    p.setRpcDataIngestionSettings({
      disabled: false,
      // Optional: add rate limiting settings if needed
      // headPollInterval: 5000, // poll every 5 seconds
      // newHeadPollInterval: 1000, // poll more frequently for new heads
    });
  }
  p.setFinalityConfirmation(cfg.network.finality);
    //xxx: can we avoid this? it's slow, wasteful, and couples us to sqd mechanics
    // if there's a way where we are not tied to all the blocks, then we should do that
    p.includeAllBlocks() // needed for proper price backfilling.
    .setBlockRange({
      from: cfg.range.fromBlock,
      ...(cfg.range.toBlock ? { to: cfg.range.toBlock } : {}),
    });

  // only set rpc url if it is provided in the config
  // if (cfg.network.rpcUrl) p.setRpcEndpoint(cfg.network.rpcUrl);
  // note: right now, we always require the rpc url to be set, even if we don't use it
  p.setRpcEndpoint(cfg.network.rpcUrl);

  p.setFields({
    log: {
      transactionHash: true,
      transaction: true,
    },
    transaction: {
      to: true,
      from: true,
      gas: true,
      effectiveGasPrice: true,
      gasUsed: true,
      status: true,
      value: true,
      sighash: true,
    },
  });

  return p;
}

export type Fields = EvmBatchProcessorFields<typeof buildBaseSqdProcessor>;
export type Block = BlockData<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext = DataHandlerContext<Database<any, any>, Fields>;
