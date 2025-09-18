import { Engine } from '../../engine/engine.ts';
import { buildAdapter } from '../../adapter-registry.ts';
import { FakeRedis } from './fakeRedis.ts';
import { FakeSink } from './fakeSink.ts';
import { FakeProcessor, type Block } from './fakeProcessor.ts';

export async function runEngineOnce(opts: {
  adapterName: string;
  config: unknown;
  blocks: Block[];
  primeRedis?: (r: FakeRedis) => Promise<void> | void;
  appCfg?: Partial<{
    indexerId: string;
    kind: 'evm' | 'solana';
    range: { toBlock?: number | null };
    flushMs: number;
    assetFeedConfig: any;
    pricingRange?: any;
  }>;
}) {
  const redis = new FakeRedis();
  const sink = new FakeSink();
  if (opts.primeRedis) await opts.primeRedis(redis);

  const appCfg = {
    indexerId: 'test-indexer',
    kind: 'evm',
    range: { toBlock: null },
    flushMs: 60_000,
    assetFeedConfig: [],
    ...opts.appCfg,
  };

  // Build adapter (adapters must have been imported to register)
  const adapter = buildAdapter(opts.adapterName, opts.config, {
    redis: redis as any,
    log: () => {},
  } as any);

  // Construct processor that replays our blocks
  const sqdProcessor = new FakeProcessor(opts.blocks);

  // Engine deps mirror your main.ts wiring
  const engine = new Engine({
    appCfg: appCfg as any,
    sink: sink as any,
    adapter,
    sqdProcessor: sqdProcessor as any,
    redis: redis as any,
  });

  // Intercept process.exit that Engine calls at final block
  const oldExit = process.exit;
  process.exit = ((code?: number) => {
    throw new Error(`EXIT_${code ?? 0}`);
  }) as any;

  let exitErr: Error | null = null;
  try {
    await engine.run();
  } catch (e: any) {
    // Expect the EXIT_0 throw when toBlock reached
    exitErr = e;
  } finally {
    process.exit = oldExit;
  }

  return { redis, sink, exitErr };
}
