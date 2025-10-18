export interface UnifiedBase {
  /** Timestamp in milliseconds since Unix epoch (UTC) */
  tsMs: number;
  /** Block height (EVM) or slot (Solana) where the event occurred */
  height: number;
  /** Chain-agnostic transaction reference (EVM tx hash, Solana tx signature, etc.) */
  txRef: string;
}
