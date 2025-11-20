import { z } from 'zod';

/**
 * UnifiedBase - Common fields for all unified chain events.
 * Provides chain-agnostic structure for events across different blockchains.
 */
export const UnifiedBaseSchema = z.object({
  /** Timestamp in milliseconds since Unix epoch (UTC) */
  tsMs: z.number(),
  /** Block height (EVM) or slot (Solana) where the event occurred */
  height: z.number(),
  /** Chain-agnostic transaction reference (EVM tx hash, Solana tx signature, etc.) */
  txRef: z.string(),
  /** Position in the transaction (EVM log index, Solana instruction index, etc.) */
  index: z.number(),
});

export type UnifiedBase = z.infer<typeof UnifiedBaseSchema>;
