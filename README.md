# Uniswap V2 Swap and LP Holding Indexer

A specialized blockchain indexer built with Subsquid framework to track LP token positions and swaps in Uniswap V2-compatible DEXes (including Velodrome).

## Overview

This project is a blockchain indexer designed to track and record:
1. LP token positions (time-weighted balances)
2. Swap events 
3. LP token pricing based on underlying token reserves

The indexer processes blockchain events in real-time, maintains historical balance records with time-weighted windows, and includes price computation for LP tokens.

## Architecture

### Core Components

- **Processor**: Configures and runs the Subsquid processor for listening to EVM events
- **Data Model**: Handles LP token balances, time windows, and transaction records
- **Price Engine**: Calculates LP token prices based on underlying reserves and Coingecko price data
- **API Client**: Sends indexed data to an external API for storage

### Data Flow

1. Listen for LP token transfers and pool sync events
2. Track LP token balances for each account
3. Record time-weighted balance windows
4. Calculate LP token pricing based on underlying token reserves
5. Send data to Absinthe API

## Key Features

- **Time-weighted Balance Tracking**: Records how long users hold LP positions
- **Real-time Price Calculation**: Computes LP token prices from reserves and underlying asset prices
- **Windowed Data Storage**: Creates periodic snapshots of LP token balances
- **Robust Error Handling**: Includes retry mechanisms for API requests
- **Configurable Indexing**: Supports different blockchains and pool contracts

## Environment Configuration

The indexer requires the following environment variables:

```
# Blockchain RPC
RPC_URL=<blockchain_rpc_endpoint>
GATEWAY_URL=<subsquid_gateway>
FROM_BLOCK=<starting_block>
TO_BLOCK=<optional_ending_block>

# Contract info
CONTRACT_ADDRESS=<lp_token_contract>
TOKEN0_COINGECKO_ID=<token0_id>
TOKEN1_COINGECKO_ID=<token1_id>

# API credentials
ABSINTHE_API_URL=<api_endpoint>
ABSINTHE_API_KEY=<api_key>
COINGECKO_API_KEY=<coingecko_key>
```

## Technical Assumptions

1. LP tokens follow the ERC-20 standard with Transfer events
2. Pool contracts emit Sync events when reserves change
3. Price data is available via Coingecko API
4. The processor starts indexing from the beginning of the pool's history

## Development

### Prerequisites
- Node.js (v16+)
- pnpm
- PostgreSQL database

### Setup
```bash
npx squid-evm-typegen src/abi ./abi/<abi.json>
npx squid-typeorm-codegen
npx squid-typeorm-migration generate
```

### Installation
```bash
pnpm install
```

### Running
```bash
pnpm build
sqd process:prod
```

### Testing
Generate sample data with test cases:
```bash
node src/__tests__/generate-test-data.js
```

## Data Model

The indexer tracks:

1. **Active Balances**: Current LP token holdings per user
2. **History Windows**: Time-weighted balance records
3. **Pool State**: Reserves and total supply
4. **Pricing Data**: USD values of LP tokens

## Implementation Details

### Balance Tracking
- LP token transfers trigger balance updates
- Records time-weighted balances in periodic windows
- Handles mints, burns, and transfers

### Price Calculation
- Retrieves price data from Coingecko
- Calculates LP token price based on:
  - Token reserves
  - Underlying token prices
  - LP token total supply

### API Integration
- Sends data to external API endpoint
- Implements exponential backoff for retry logic
- Handles rate limiting via Bottleneck

## License

This project is licensed under the MIT License - see the LICENSE file for details.
