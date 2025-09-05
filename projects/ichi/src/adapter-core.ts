// adapter-core.ts - Core types and utilities for the adapter registry pattern
import { z, ZodTypeAny } from 'zod';
import { RedisClientType } from 'redis';
import {
  LogEmitFunctions,
  RpcContext,
  Projector,
  CustomFeedHandlers,
  TransactionEmitFunctions,
} from './types/adapter';
import { Block, Log, Transaction } from './processor';
import { BaseProcessor } from './eprocessorBuilder';

// Engine IO interface for dependency injection
export type EngineIO = {
  redis: RedisClientType;
  log: (...args: any[]) => void;
};

type OnArgs = {
  block: Block;
  rpcCtx: RpcContext;
  redis: RedisClientType;
};

export type OnLogArgs = OnArgs & {
  log: Log;
  emit: LogEmitFunctions;
};

export type OnTransactionArgs = OnArgs & {
  transaction: Transaction;
  emit: TransactionEmitFunctions;
};

// Adapter hooks that define the contract for all adapters
export type AdapterHooks = {
  // Zod schema for validating adapter configuration
  adapterCustomConfig?: ZodTypeAny;

  // Function to extend the base processor with adapter-specific subscriptions
  buildProcessor: (base: BaseProcessor) => BaseProcessor;

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
export type BuiltAdapter = AdapterHooks & {
  // Adapter name for debugging and logging
  __adapterName: string;
};

// Adapter definition with schema and builder
export type AdapterDef<P extends ZodTypeAny> = {
  name: string;
  schema: P;
  build: (opts: {
    params: z.infer<P>; // Already parsed and transformed
    io: EngineIO; // DI if you want to build with env
  }) => BuiltAdapter;
};

// Factory to help with generics inference
export function defineAdapter<P extends ZodTypeAny>(def: AdapterDef<P>) {
  return def;
}

// Utility type for address validation with transformation
export const Address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .transform((s) => s.toLowerCase());

export type Address = z.infer<typeof Address>;
