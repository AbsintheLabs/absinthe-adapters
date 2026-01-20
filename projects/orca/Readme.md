# Orca Adapter

The Orca adapter indexes Solana's Orca Whirlpool DEX protocol. It processes swap, liquidity, fee, position, and pool instructions from the blockchain, reconstructs LP position state (including post-swap sqrtPrice), and sends structured events to the Absinthe API for points tracking.

**Key features:**
- Tracks swaps, liquidity changes, fee collection, and position management
- Reconstructs pool state (sqrtPrice) by replaying instructions (Solana doesn't support historical state queries)
- Processes instructions in batches for efficiency
- Sends time-weighted balance events and transaction data to Absinthe API

## How to start

1. Install dependencies: `pnpm install` (from repo root)
2. Configure environment: Set `ABS_CONFIG` env var or use `abs_config.json` with Orca protocol config
3. Run: `pnpm dev` (from this directory)

---