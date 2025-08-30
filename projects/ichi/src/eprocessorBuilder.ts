// processor/build.ts
import { EvmBatchProcessor } from '@subsquid/evm-processor';
// import { SolanaBatchProcessor } from '@subsquid/solana-processor';
import type { AppConfig } from './config/schema';

export function buildProcessor(cfg: AppConfig, adapterTopic0s?: string[]) {
  if (cfg.kind === 'evm') {
    const p = new EvmBatchProcessor()
      .setGateway(cfg.network.gatewayUrl as string)
      .setRpcEndpoint(cfg.network.rpcUrl as string)
      .setFinalityConfirmation(cfg.network.finality as number)
      .includeAllBlocks() // needed for proper price backfilling
      .setBlockRange({
        from: cfg.range.fromBlock,
        ...(cfg.range.toBlock && cfg.range.toBlock !== 0 ? { to: cfg.range.toBlock } : {}),
      });

    for (const l of cfg.subscriptions.logs)
      p.addLog({
        transaction: true,
        address: l.addresses,
        ...(adapterTopic0s && adapterTopic0s.length > 0 ? { topic0: adapterTopic0s } : {}),
      });

    for (const t of cfg.subscriptions.functionCalls)
      p.addTransaction({
        to: t.to,
        sighash: t.sighash,
      });

    p.setFields({
      log: { transactionHash: true },
      transaction: { to: true, from: true, gas: true, gasPrice: true, gasUsed: true, status: true },
    });

    return p;
  }

  // Solana branch (outline)
  // const s = new SolanaBatchProcessor()
  //   .setGateway(cfg.network.gatewayUrl)
  //   .setRpcEndpoint({ url: cfg.network.rpcUrl, commitment: cfg.network.commitment })
  //   .setSlotRange({ from: cfg.range.fromSlot, ...(cfg.range.toSlot ? { to: cfg.range.toSlot } : {}) });
  // for (const prog of cfg.subscriptions.programs) s.addProgram(prog);
  // for (const ix of cfg.subscriptions.instructions) s.addInstruction(ix);   // track instructions  [oai_citation:11‡docs.sqd.dev](https://docs.sqd.dev/solana-indexing/sdk/solana-batch/instructions/?utm_source=chatgpt.com)
  // for (const lg of cfg.subscriptions.logs) s.addLogMessages(lg);
  // return s;
}
