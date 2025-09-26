// adapter-core.ts - Core types and utilities for the adapter registry pattern
import { z, ZodTypeAny } from 'zod';
import { Redis } from 'ioredis';
import { EmitFunctions, RpcContext, Projector, CustomFeedHandlers } from './types/adapter.ts';
import { BaseProcessor, Block, Log, Transaction } from './eprocessorBuilder.ts';
import { ProtocolFamily } from './constants.ts';

// Engine IO interface for dependency injection
export type EngineIO = {
  redis: Redis;
  log: (...args: any[]) => void;
};

type OnArgs = {
  block: Block;
  rpcCtx: RpcContext;
  redis: Redis;
  emit: EmitFunctions;
  instances: TrackableInstance[];
};

export type OnLogArgs = OnArgs & {
  log: Log;
};

export type OnTransactionArgs = OnArgs & {
  transaction: Transaction;
};

export type OnInitArgs = {
  rpcCtx: RpcContext;
  redis: Redis;
};

// Adapter hooks that define the contract for all adapters
export type AdapterHooks = {
  // Function to extend the base processor with adapter-specific subscriptions
  buildProcessor: (base: BaseProcessor) => BaseProcessor;

  // Optional hook called when the adapter is initialized
  onInit?: (args: OnInitArgs) => Promise<void>;

  // Optional hook called for each log event
  onLog?: (args: OnLogArgs) => Promise<void>;

  onTransaction?: (args: OnTransactionArgs) => Promise<void>;

  // Optional hook called at the end of each batch
  onBatchEnd?: (args: { io: EngineIO; ctx: any }) => Promise<void>;

  // Optional projectors for custom event processing
  projectors?: Projector[];

  // Optional custom feed handlers
  customFeeds?: CustomFeedHandlers;
};

// Built adapter with contextual state captured by the builder
export type BuiltAdapter = AdapterHooks;

export const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
export const SemVer = z.string().regex(SEMVER_RE, 'Invalid SemVer').brand<'SemVer'>();
export type SemVer = z.infer<typeof SemVer>;

// Adapter definition with schema and builder
export type AdapterDef<P extends ZodTypeAny> = {
  manifest?: any; // xxx update this to be a proper type
  name: string;
  semver: string;
  forkOf?: ProtocolFamily;
  schema: P;
  build: (opts: {
    params: z.infer<P>; // Already parsed and transformed
    io: EngineIO; // DI if you want to build with env
  }) => BuiltAdapter;
};

// Factory to help with generics inference
// todo: remove this import from everywhere
/**
 * @deprecated This helper is deprecated and will be removed in a future release.
 */
export function defineAdapter<P extends ZodTypeAny>(def: AdapterDef<P>) {
  return def;
}

// Utility type for address validation with transformation
export const ZodEvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .transform((s) => s.toLowerCase());

export type ZodEvmAddress = z.infer<typeof ZodEvmAddress>;
