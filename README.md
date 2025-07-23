# Absinthe Adapter API - Comprehensive Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design](#architecture--design)
3. [Supported Protocols](#supported-protocols)
4. [Core Components](#core-components)
5. [Data Flow & Processing](#data-flow--processing)
6. [Configuration & Setup](#configuration--setup)
7. [API Integration](#api-integration)
8. [Development Guide](#development-guide)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Absinthe Adapter API** is a comprehensive blockchain indexing platform built with the Subsquid framework that provides real-time tracking and analysis of multiple DeFi protocols across various blockchain networks. The platform specializes in tracking liquidity positions, token swaps, staking activities, and bonding curve interactions with sophisticated time-weighted balance calculations.

### Key Capabilities

- **Multi-Protocol Support**: Indexes 15+ different DeFi protocols including DEXs, staking platforms, and bonding curves
- **Cross-Chain Compatibility**: Supports 6 major blockchain networks (Ethereum, Polygon, Arbitrum, Base, Optimism, Hemi)
- **Real-Time Processing**: Processes blockchain events in real-time with configurable batch processing
- **Time-Weighted Analytics**: Calculates time-weighted balances for accurate position tracking
- **Price Integration**: Integrates with CoinGecko API for real-time price data
- **Scalable Architecture**: Built with TypeScript and Subsquid for high-performance indexing

### What It Tracks

1. **LP Token Positions**: Time-weighted balance tracking for liquidity providers
2. **Swap Events**: Real-time monitoring of token swaps across all supported protocols
3. **Staking Activities**: Deposit/withdrawal events and balance changes in staking protocols
4. **Bonding Curve Interactions**: Token trades and liquidity deployments in bonding curve protocols
5. **Position Management**: NFT position tracking for Uniswap V3 and similar protocols
6. **Price Calculations**: USD value calculations for all tracked assets

---

## Architecture & Design

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Blockchain    │    │   Subsquid      │    │   Absinthe      │
│   Networks      │───▶│   Processor     │───▶│   API           │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │       OR
                            Redis        │
                       └─────────────────┘
```

### Core Design Principles

1. **Modular Architecture**: Each protocol has its own processor and data models
2. **Type Safety**: Full TypeScript implementation with strict type checking
3. **Configuration-Driven**: Protocol support configured via JSON files
4. **Event-Driven Processing**: Real-time event processing with batch optimization
5. **Fault Tolerance**: Robust error handling and retry mechanisms

### Technology Stack

- **Framework**: Subsquid (blockchain indexing framework)
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **In-Memory-Store**: Redis
- **Package Manager**: pnpm (monorepo structure)
- **API Integration**: RESTful API with rate limiting
- **Price Data**: CoinGecko API integration
- **Containerization**: Docker support

---

## Supported Protocols

### 1. DEX Protocols (Decentralized Exchanges)

#### Uniswap V2

- **Purpose**: Track LP token transfers, swaps, and liquidity events
- **Events Monitored**: `Transfer`, `Sync`, `Swap`
- **Features**: Time-weighted balance tracking, price calculations
- **Supported Chains**: Ethereum, Base

#### Uniswap V3

- **Purpose**: Advanced position tracking with NFT positions
- **Events Monitored**: `PoolCreated`, `Swap`, `IncreaseLiquidity`, `DecreaseLiquidity`, `Collect`, `Transfer`
- **Features**: Position management, fee tier tracking, concentrated liquidity
- **Supported Chains**: Ethereum

### 2. Staking Protocols

#### Hemi Staking

- **Purpose**: Track staking deposits and withdrawals
- **Events Monitored**: `Deposit`, `Withdraw`
- **Features**: Time-weighted balance tracking, reward calculations
- **Supported Chains**: Hemi (43111)

#### VUSD Bridge

- **Purpose**: Cross-chain staking bridge tracking
- **Events Monitored**: Bridge events, staking activities
- **Supported Chains**: Ethereum

### 3. Bonding Curve Protocols

#### Printr

- **Purpose**: Track bonding curve token trades
- **Events Monitored**: `CurveCreated`, `TokenTrade`, `LiquidityDeployed`, `Swap`
- **Features**: Curve parameter tracking, trade volume analysis
- **Supported Chains**: Base

#### VUSD Mint

- **Purpose**: Stablecoin minting protocol tracking
- **Events Monitored**: Minting events, price stabilization
- **Supported Chains**: Ethereum

#### Demos

- **Purpose**: Demo bonding curve implementation
- **Events Monitored**: Custom demo events
- **Supported Chains**: Hemi

#### Voucher

- **Purpose**: Voucher token system tracking
- **Events Monitored**: Voucher creation, redemption
- **Supported Chains**: Ethereum

### 5. Specialized Protocols

#### Zebu (New & Legacy)

- **Purpose**: Auction and bidding platform tracking
- **Events Monitored**: `Auction_BidPlaced`, bidding events
- **Features**: Auction tracking, bid analysis
- **Supported Chains**: Polygon, Base

---

## Core Components

### 1. Processor Layer

Each protocol has its own processor that:

- **Configures Event Listening**: Sets up blockchain event subscriptions
- **Handles Data Extraction**: Decodes blockchain events into structured data
- **Manages State**: Maintains protocol-specific state and balances
- **Processes Batches**: Handles batch processing for efficiency

### 2. Data Model Layer

#### Common Models

```typescript
interface ProtocolState {
  activeBalances: Map<string, Map<string, ActiveBalance>>;
  balanceWindows: TimeWeightedBalanceEvent[];
  transactions: TransactionEvent[];
}

interface ActiveBalance {
  balance: bigint;
  updatedBlockTs: number;
  updatedBlockHeight: number;
}

interface TimeWeightedBalanceEvent {
  userAddress: string;
  deltaAmount: number;
  trigger: TimeWindowTrigger;
  startTs: number;
  endTs: number;
  windowDurationMs: number;
  tokenPrice: number;
  valueUsd: number;
}
```

#### Protocol-Specific Models

Each protocol extends the base models with protocol-specific fields:

- **DEX Models**: Pool states, swap events, liquidity positions
- **Staking Models**: Staking positions, reward tracking
- **Bonding Curve Models**: Curve parameters, trade history

### 3. Price Engine

#### Price Sources

- **CoinGecko API**: Primary price data source
- **Codex**: Alternative price feed
- **Internal TWAP**: Time-weighted average price calculations

#### Price Calculation Logic

```typescript
// LP Token Price Calculation
const lpTokenPrice = (reserve0 * price0 + reserve1 * price1) / totalSupply;

// Time-Weighted Balance Calculation
const timeWeightedBalance = (balance * (endTime - startTime)) / windowDuration;
```

### 4. API Client

#### Features

- **Rate Limiting**: Bottleneck-based rate limiting
- **Retry Logic**: Exponential backoff for failed requests
- **Batch Processing**: Efficient batch data transmission
- **Error Handling**: Comprehensive error handling and logging

#### Data Transmission

```typescript
interface TransactionEvent {
  eventType: MessageType.TRANSACTION;
  eventName: string;
  tokens: Record<string, { value: string; type: string }>;
  rawAmount: string;
  displayAmount: number;
  valueUsd: number;
  gasUsed: number;
  gasFeeUsd: number;
  // ... other fields
}
```

---

## Data Flow & Processing

### 1. Event Processing Pipeline

```
Blockchain Event → Subsquid Processor → Event Decoder → State Manager → API Client
```

#### Step-by-Step Process

1. **Event Detection**: Subsquid processor detects relevant blockchain events
2. **Event Decoding**: Raw event data is decoded using protocol-specific ABIs
3. **State Update**: Protocol state is updated based on event data
4. **Balance Calculation**: Time-weighted balances are calculated
5. **Price Integration**: USD values are calculated using price feeds
6. **Data Transmission**: Processed data is sent to Absinthe API

### 2. Time-Weighted Balance Tracking

#### Window-Based Processing

- **Configurable Windows**: Balance snapshots taken at configurable intervals
- **Trigger Events**: Balance updates triggered by transfers or time windows
- **Accurate Tracking**: Maintains historical balance records with timestamps

#### Balance Calculation Example

```typescript
// For a user holding 1000 LP tokens for 24 hours
const balanceWindow = {
  userAddress: '0x...',
  deltaAmount: 0, // No change in balance
  startTs: 1640995200, // Start of day
  endTs: 1641081600, // End of day
  windowDurationMs: 86400000, // 24 hours
  balanceBefore: '1000',
  balanceAfter: '1000',
  valueUsd: 5000, // Calculated USD value
};
```

### 3. Batch Processing

#### Optimization Features

- **Batch Size Control**: Configurable batch sizes for optimal performance
- **Parallel Processing**: Multiple protocols processed in parallel
- **Memory Management**: Efficient memory usage with streaming processing
- **Error Recovery**: Graceful handling of processing errors

---

## Configuration & Setup

### 1. Environment Configuration

#### Required Environment Variables

```bash
# Blockchain RPC Endpoints
RPC_URL_MAINNET=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
RPC_URL_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY
RPC_URL_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY
RPC_URL_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
RPC_URL_OPTIMISM=https://opt-mainnet.g.alchemy.com/v2/YOUR-API-KEY
RPC_URL_HEMI=https://hemi-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# API Configuration
ABSINTHE_API_URL=https://adapters-dev.absinthe.network
ABSINTHE_API_KEY=your-absinthe-api-key
ABS_CONFIG='{"balanceFlushIntervalHours":6,"dexProtocols":[{"type":"uniswap-v2","chainId":1,"toBlock":0,"protocols":[{"name":"pepe-weth","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":17046833,"pricingStrategy":"coingecko","token0":{"coingeckoId":"pepe","decimals":18},"token1":{"coingeckoId":"weth","decimals":18},"preferredTokenCoingeckoId":"token1"}]},{"type":"izumi","chainId":42161,"toBlock":0,"protocols":[{"name":"weth-hemitbtc","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":1276815,"pricingStrategy":"coingecko","token0":{"coingeckoId":"weth","decimals":18},"token1":{"coingeckoId":"btc","decimals":8},"preferredTokenCoingeckoId":"token1"},{"name":"vusd-weth","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":1274620,"pricingStrategy":"coingecko","token0":{"coingeckoId":"vesper-vdollar","decimals":18},"token1":{"coingeckoId":"weth","decimals":18},"preferredTokenCoingeckoId":"token1"}]}],"bondingCurveProtocols":[{"type":"printr","name":"printr-base","contractAddress":"0xbdc9a5b600e9a10609b0613b860b660342a6d4c0","factoryAddress":"0x33128a8fc17869897dce68ed026d694621f6fdfd","chainId":8453,"toBlock":0,"fromBlock":30000000},{"type":"vusd-mint","name":"vusd-mint","contractAddress":"0xFd22Bcf90d63748288913336Cd38BBC0e681e298","chainId":1,"toBlock":0,"fromBlock":22017054},{"type":"demos","name":"demos","contractAddress":"0x70468f06cf32b776130e2da4c0d7dd08983282ec","chainId":43111,"toBlock":0,"fromBlock":1993447},{"type":"voucher","name":"voucher","contractAddress":"0xa26b04b41162b0d7c2e1e2f9a33b752e28304a49","chainId":1,"toBlock":0,"fromBlock":21557766}],"stakingProtocols":[{"type":"hemi","name":"hemi-staking","contractAddress":"0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83","chainId":43111,"toBlock":0,"fromBlock":2025621},{"type":"vusd-bridge","name":"vusd-bridge","contractAddress":"0x5eaa10F99e7e6D177eF9F74E519E319aa49f191e","chainId":1,"toBlock":0,"fromBlock":22695105}],"univ3Protocols":[{"type":"uniswap-v3","chainId":1,"factoryAddress":"0x1f98431c8ad98523631ae4a59f267346ea31f984","factoryDeployedAt":12369621,"positionsAddress":"0xc36442b4a4522e871399cd717abdd847ab11fe88","toBlock":0,"poolDiscovery":true,"trackPositions":true,"trackSwaps":true,"pools":[{"name":"pepe-weth-0.3","contractAddress":"0x11950d141ecb863f01007add7d1a342041227b58","fromBlock":13609065,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"PEPE","decimals":18},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"},{"name":"wepe-weth-0.3","contractAddress":"0xa3c2076eb97d573cc8842f1db1ecdf7b6f77ba27","fromBlock":12376729,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"WEPE","decimals":18},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"},{"name":"usdc-weth-0.3","contractAddress":"0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640","fromBlock":1620250931,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"USDC","decimals":6},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"}]}],"zebuProtocols":[{"type":"zebu","name":"zebu-new","toBlock":0,"clients":[{"name":"xyz-1","contractAddress":"0xD71954165a026924cA771C53164FB0a781c54C83","chainId":137,"fromBlock":61059459},{"name":"xyz-2","contractAddress":"0x3e4768dB375094b753929B7A540121d970fcb24e","chainId":137,"fromBlock":61059459},{"name":"xyz-3","contractAddress":"0x5859Ff44A3BDCD00c7047E68B94e93d34aF0fd71","chainId":8453,"fromBlock":15286409},{"name":"xyz-4","contractAddress":"0xE3EB2347bAE4E2C6905D7B832847E7848Ff6938c","chainId":137,"fromBlock":61695150},{"name":"xyz-5","contractAddress":"0x19633c8006236f6c016a34B9ca48e98AD10418B4","chainId":137,"fromBlock":64199277},{"name":"xyz-6","contractAddress":"0x0c18F35EcfF53b7c587bD754fc070b683cB9063B","chainId":8453,"fromBlock":20328800},{"name":"xyz-7","contractAddress":"0xDD4d9ae148b7c821b8157828806c78BD0FeCE8C4","chainId":137,"fromBlock":73490308}]},{"type":"zebu","name":"zebu-legacy","toBlock":0,"clients":[{"name":"xyz-1","contractAddress":"0xd7829F0EFC16086a91Cf211CFbb0E4Ef29D16BEE","chainId":8453,"fromBlock":27296063}]}]}'

# Price Data
COINGECKO_API_KEY=your-coingecko-api-key

# Database Configuration
DB_URL=postgresql://username:password@localhost:5432/database
REDIS_URL="redis://localhost:6379"

# Logging
LOG_FILE_PATH=./logs/indexer.log
```

#### Environment Variable Sources

| Variable          | Purpose                 | How to Obtain                           |
| ----------------- | ----------------------- | --------------------------------------- | ------------ |
| RPC*URL*\*        | Blockchain connectivity | Alchemy, Infura, or other RPC providers |
| ABSINTHE*API*\*   | Data transmission       | Contact Absinthe team                   |
| COINGECKO_API_KEY | Price data              | Sign up at coingecko.com/en/api         |
| DB_URL/REDIS_URL  | Database connection     | PostgreSQL setup (local or cloud)       | Redis Server |
| ABS_CONFIG        | env config              | Make sure to paste it as a string       |

### 2. Protocol Configuration

#### Configuration File Structure

```json
{
  "balanceFlushIntervalHours": 6,
  "dexProtocols": [...],
  "bondingCurveProtocols": [...],
  "stakingProtocols": [...],
  "univ3Protocols": [...],
  "zebuProtocols": [...]
}
```

#### Protocol Configuration Examples

**Uniswap V2 Configuration**

```json
{
  "type": "uniswap-v2",
  "chainId": 1,
  "toBlock": 0,
  "protocols": [
    {
      "name": "pepe-weth",
      "contractAddress": "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
      "fromBlock": 17046833,
      "pricingStrategy": "coingecko",
      "token0": {
        "coingeckoId": "pepe",
        "decimals": 18
      },
      "token1": {
        "coingeckoId": "weth",
        "decimals": 18
      },
      "preferredTokenCoingeckoId": "token1"
    }
  ]
}
```

**Staking Protocol Configuration**

```json
{
  "type": "hemi",
  "name": "hemi-staking",
  "contractAddress": "0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83",
  "chainId": 43111,
  "toBlock": 0,
  "fromBlock": 2025621
}
```

### 3. Setup Instructions

#### Prerequisites

- Node.js (v20+)
- pnpm package manager
- PostgreSQL database
- API keys for required services

#### Installation Steps

1. **Clone and Install**

```bash
git clone https://github.com/AbsintheLabs/absinthe-adapters.git
cd absinthe-adapters
pnpm install
```

2. **Environment Setup**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Configuration Setup**

```bash
ABS_CONFIG='{"balanceFlushIntervalHours":6,"dexProtocols":[{"type":"uniswap-v2","chainId":1,"toBlock":0,"protocols":[{"name":"pepe-weth","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":17046833,"pricingStrategy":"coingecko","token0":{"coingeckoId":"pepe","decimals":18},"token1":{"coingeckoId":"weth","decimals":18},"preferredTokenCoingeckoId":"token1"}]},{"type":"izumi","chainId":42161,"toBlock":0,"protocols":[{"name":"weth-hemitbtc","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":1276815,"pricingStrategy":"coingecko","token0":{"coingeckoId":"weth","decimals":18},"token1":{"coingeckoId":"btc","decimals":8},"preferredTokenCoingeckoId":"token1"},{"name":"vusd-weth","contractAddress":"0xa43fe16908251ee70ef74718545e4fe6c5ccec9f","fromBlock":1274620,"pricingStrategy":"coingecko","token0":{"coingeckoId":"vesper-vdollar","decimals":18},"token1":{"coingeckoId":"weth","decimals":18},"preferredTokenCoingeckoId":"token1"}]}],"bondingCurveProtocols":[{"type":"printr","name":"printr-base","contractAddress":"0xbdc9a5b600e9a10609b0613b860b660342a6d4c0","factoryAddress":"0x33128a8fc17869897dce68ed026d694621f6fdfd","chainId":8453,"toBlock":0,"fromBlock":30000000},{"type":"vusd-mint","name":"vusd-mint","contractAddress":"0xFd22Bcf90d63748288913336Cd38BBC0e681e298","chainId":1,"toBlock":0,"fromBlock":22017054},{"type":"demos","name":"demos","contractAddress":"0x70468f06cf32b776130e2da4c0d7dd08983282ec","chainId":43111,"toBlock":0,"fromBlock":1993447},{"type":"voucher","name":"voucher","contractAddress":"0xa26b04b41162b0d7c2e1e2f9a33b752e28304a49","chainId":1,"toBlock":0,"fromBlock":21557766}],"stakingProtocols":[{"type":"hemi","name":"hemi-staking","contractAddress":"0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83","chainId":43111,"toBlock":0,"fromBlock":2025621},{"type":"vusd-bridge","name":"vusd-bridge","contractAddress":"0x5eaa10F99e7e6D177eF9F74E519E319aa49f191e","chainId":1,"toBlock":0,"fromBlock":22695105}],"univ3Protocols":[{"type":"uniswap-v3","chainId":1,"factoryAddress":"0x1f98431c8ad98523631ae4a59f267346ea31f984","factoryDeployedAt":12369621,"positionsAddress":"0xc36442b4a4522e871399cd717abdd847ab11fe88","toBlock":0,"poolDiscovery":true,"trackPositions":true,"trackSwaps":true,"pools":[{"name":"pepe-weth-0.3","contractAddress":"0x11950d141ecb863f01007add7d1a342041227b58","fromBlock":13609065,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"PEPE","decimals":18},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"},{"name":"wepe-weth-0.3","contractAddress":"0xa3c2076eb97d573cc8842f1db1ecdf7b6f77ba27","fromBlock":12376729,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"WEPE","decimals":18},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"},{"name":"usdc-weth-0.3","contractAddress":"0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640","fromBlock":1620250931,"feeTier":3000,"pricingStrategy":"internal-twap","token0":{"symbol":"USDC","decimals":6},"token1":{"symbol":"WETH","decimals":18},"preferredTokenCoingeckoId":"token1"}]}],"zebuProtocols":[{"type":"zebu","name":"zebu-new","toBlock":0,"clients":[{"name":"xyz-1","contractAddress":"0xD71954165a026924cA771C53164FB0a781c54C83","chainId":137,"fromBlock":61059459},{"name":"xyz-2","contractAddress":"0x3e4768dB375094b753929B7A540121d970fcb24e","chainId":137,"fromBlock":61059459},{"name":"xyz-3","contractAddress":"0x5859Ff44A3BDCD00c7047E68B94e93d34aF0fd71","chainId":8453,"fromBlock":15286409},{"name":"xyz-4","contractAddress":"0xE3EB2347bAE4E2C6905D7B832847E7848Ff6938c","chainId":137,"fromBlock":61695150},{"name":"xyz-5","contractAddress":"0x19633c8006236f6c016a34B9ca48e98AD10418B4","chainId":137,"fromBlock":64199277},{"name":"xyz-6","contractAddress":"0x0c18F35EcfF53b7c587bD754fc070b683cB9063B","chainId":8453,"fromBlock":20328800},{"name":"xyz-7","contractAddress":"0xDD4d9ae148b7c821b8157828806c78BD0FeCE8C4","chainId":137,"fromBlock":73490308}]},{"type":"zebu","name":"zebu-legacy","toBlock":0,"clients":[{"name":"xyz-1","contractAddress":"0xd7829F0EFC16086a91Cf211CFbb0E4Ef29D16BEE","chainId":8453,"fromBlock":27296063}]}]}'

```

you can edit it

4. **Database/Redis Setup**

```bash
# For local development
docker-compose up -d postgres

# Or configure external database
```

5. **Code Generation**

```bash
cd projects/uniswapv2
pnpm typegen
pnpm codegen
pnpm migration
```

6. **Run Development**

```bash
pnpm dev
```

---

## API Integration

### 1. Absinthe API Client

#### Client Configuration

```typescript
const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // Rate limiting
});
```

#### Data Transmission

```typescript
// Send transaction events
await apiClient.send(transactions);

// Send time-weighted balance events
await apiClient.send(balances);
```

### 2. Rate Limiting & Retry Logic

#### Bottleneck Configuration

- **Rate Limiting**: 90ms minimum between requests
- **Queue Management**: Automatic request queuing
- **Retry Logic**: Exponential backoff for failed requests

#### Error Handling

```typescript
try {
  await apiClient.send(data);
} catch (error) {
  console.error('API transmission failed:', error);
  // Automatic retry with exponential backoff
}
```

## Development Guide

### Prerequisites

- Node.js (v20+)
- pnpm package manager
- PostgreSQL database
- API keys for required services

### Step 1: Environment Variables Setup

First, copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific values. See the [Environment Configuration](#environment-configuration) section above for detailed instructions on obtaining each required variable.

### Step 2: Protocol Configuration Setup

The indexer uses a JSON configuration file to define which protocols and pools to track.

you would need to pass the json as a string in
and you can dynamically change the things in this schema, which would be dynamically picked
something like this please add

#### Core Settings

- **`chainId`**: The blockchain network ID (1 for Ethereum mainnet)
- **`gatewayUrl`**: Subsquid gateway URL for your target network
- **`balanceFlushIntervalHours`**: How often to create balance snapshots (in hours)
- **`toBlock`**: Optional ending block number for indexing

#### Protocol Configuration (Example)

For each Uniswap V2 pool you want to track:

- **`type`**: Can be any dex type, for now we are using `"uniswap-v2"`
- **`name`**: Descriptive name for the pool
- **`contractAddress`**: The pool's contract address
- **`fromBlock`**: Block number when the pool was created
- **`pricingStrategy`**: Price data source (currently `"coingecko"`)
- **`token0`** and **`token1`**: Token configurations with:
  - `coingeckoId`: CoinGecko API identifier for the token
  - `decimals`: Number of decimal places for the token
- **`preferredTokenCoingeckoId`**: Which token to use for pricing (`"token0"` or `"token1"`)

#### Example Configuration

```json
{
  "chainId": 1,
  "gatewayUrl": "https://v2.archive.subsquid.io/network/ethereum-mainnet",
  "balanceFlushIntervalHours": 24,
  "toBlock": 14981079,
  "protocols": [
    {
      "type": "uniswap-v2",
      "name": "USDC/WETH Pool",
      "contractAddress": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
      "fromBlock": 10008355,
      "pricingStrategy": "coingecko",
      "token0": {
        "coingeckoId": "usd-coin",
        "decimals": 6
      },
      "token1": {
        "coingeckoId": "weth",
        "decimals": 18
      },
      "preferredTokenCoingeckoId": "token0"
    }
  ]
}
```

#### Important Notes

⚠️ **Configuration File Priority**: The system will look for `abs_config.json` first. If not found, it will fall back to `abs_config.example.json`. For production deployments, always use `abs_config.json`.

⚠️ **Git Ignore**: The `abs_config.json` file is included in `.gitignore` to prevent accidentally committing sensitive configuration data.

### Step 3: Install Dependencies

```bash
pnpm install
```

### Step 4: One-Click Deployment

The indexer automatically validates both your environment variables and configuration file on startup. If there are any issues, you'll see detailed error messages indicating what needs to be fixed.

#### Deploy Specific Protocol Adapters

Choose the appropriate adapter based on the protocol you want to index:

**Uniswapv2 Protocol Adapters:**
[![Deploy Uniswap V2 on Railway](https://railway.com/button.svg)](https://railway.com/deploy/univ2-adapter?referralCode=Nsq9l9)

**Uniswapv3 Protocol Adapter:**
[![Deploy Uniswap V3 on Railway](https://railway.com/button.svg)](https://railway.com/deploy/univ3-adapter?referralCode=Nsq9l9)

**Hemi-Staking Protocol Adapters:**
[![Deploy Hemi Staking on Railway](https://railway.com/button.svg)](https://railway.com/deploy/hemistaking-adapter?referralCode=Nsq9l9)

**Printr Protocol Adapters:**
[![Deploy Printr on Railway](https://railway.com/button.svg)](https://railway.com/deploy/printr-adapter?referralCode=Nsq9l9)

**Demos Protocol Adapter:**
[![Deploy Demos on Railway](https://railway.com/button.svg)](https://railway.com/deploy/demos-adapter?referralCode=Nsq9l9)

**Zebu Protocol Adapters:**
[![Deploy Zebu on Railway](https://railway.com/button.svg)](https://railway.com/deploy/zebu-adapter?referralCode=Nsq9l9)

#### After Deployment

1. **Configure Environment Variables**: Set up your RPC URLs, API keys, and database connection
2. **Customize Configuration**: Modify the protocol configuration to match your specific pools/contracts
3. **Monitor Logs**: Check the deployment logs to ensure proper indexing
4. **Verify Data**: Confirm that events are being processed and sent to the Absinthe API

Each adapter is pre-configured with the appropriate protocol settings and will automatically start indexing once deployed and configured.

### Next Steps

Your `.env` file with all required environment variables

You can proceed with the development setup below.

## Development

### Prerequisites

- Node.js (v20+)
- pnpm
- Setup .env file

Option 1: If you want to run the indexer locally on container, you can use docker-compose to start the database and the indexer.

```bash
sudo docker-compose up -d
```

Option 2: If you want to run the indexer locally on your machine, you can use the following command to start the indexer.
Make sure you already have postgres instance running, and modify the .env file with the correct values.

```bash
pnpm install

cd packages/common
pnpm typegen

cd projects/uniswapv2
pnpm typegen
pnpm codegen
pnpm migration (would fail if nothing to migrate)

pnpm dev
```

## Structure of the project

```bash
├── abi/ # Smart contract ABI files
├── abs-app/ # Absinthe API application
│ ├── src/
│ │ └── index.ts
│ ├── tsconfig.json
│ └── package.json
├── packages/
│ └── common/
│ └── src/
│ ├── types/
│ │ ├── interfaces.ts # Core type definitions
│ │ ├── protocols.ts # Protocol configurations
│ │ ├── schema.ts # Validation schemas
│ │ └── tokens.ts
│ └── utils/
│ └── chains.ts # Chain configuration data
├── projects/
│ ├── compoundv2/ # Compound V2 indexer
│ │ ├── src/
│ │ │ └── model/
│ │ │ └── generated/
│ │ │ ├── activeBalances.model.ts
│ │ │ ├── poolConfig.model.ts
│ │ │ ├── poolState.model.ts
│ │ │ └── token.model.ts
│ │ └── schema.graphql
│ └── uniswapv2/ # Uniswap V2 indexer
│ └── src/
│ └── model/
│ └── generated/
│ ├── activeBalances.model.ts
│ ├── poolConfig.model.ts
│ └── token.model.ts
├── db/ # Database migrations
│ └── migrations/
├── logs/ # Application logs
├── .env.example # Environment variables template
├── abs_config.example.json # Protocol configuration template
├── commands.json # Subsquid commands configuration
├── docker-compose.yml # Docker services setup
├── tsconfig.base.json # Base TypeScript configuration
├── tsconfig.json # Main TypeScript configuration
├── README.md
├── LICENSE
├── package.json
└── pnpm-lock.yaml
```

## Contributing

We welcome contributions to the Absinthe Adapters project! This section outlines the development practices, tools, and guidelines for contributors.

### Development Environment Setup

Before contributing, ensure you have the proper development environment set up as described in the [Development](#development) section above.

### Code Quality Tools

Our project uses several tools to maintain code quality and consistency:

#### ESLint

We use ESLint with TypeScript support for code linting and catching potential issues.

- **Configuration**: See `eslint.config.js` for the full configuration
- **Rules**: Includes TypeScript-specific rules and Prettier integration
- **Ignored files**: Generated files, builds, and migrations are excluded

**Commands**:

```bash
# Run linting on all TypeScript files
pnpm lint

# Auto-fix linting issues where possible
pnpm lint:fix

# Lint only changed files (useful during development)
pnpm lint:changed

# Lint only staged files (used in pre-commit hooks)
pnpm lint:staged
```

#### Prettier

Code formatting is handled automatically by Prettier to ensure consistent code style.

- **Configuration**: See `.prettierrc` for formatting rules
- **Settings**: Single quotes, semicolons, trailing commas, 100 character line width
- **Ignored files**: See `.prettierignore` for excluded files

**Commands**:

```bash
# Format all files
pnpm format

# Format only changed files
pnpm format:changed

# Format only staged files
pnpm format:staged

# Check formatting without making changes
pnpm format:check
```

#### Husky Git Hooks

We use Husky to run automated checks before commits to ensure code quality.

**Pre-commit hooks** (`.husky/pre-commit`):

1. **Prettier formatting**: Automatically formats staged files
2. **ESLint checks**: Runs linting on staged TypeScript files
3. **Validation**: Ensures all checks pass before allowing commit

The hooks run automatically when you commit. If any check fails, the commit will be rejected.

### Commit Message Guidelines

Follow conventional commit format for clear commit history:

```
type(scope): description

feat(uniswap): add support for new pool types
fix(pricing): resolve decimal precision issues
docs(readme): update configuration instructions
chore(deps): update dependencies
```

**Types**:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `test`: Test additions/changes

### Adding New Protocol Support

When adding support for a new protocol:

1. **Create project directory**: `projects/{protocol-name}/`
2. **Define schema**: Create `schema.graphql` with required entities
3. **Generate models**: Run `pnpm typegen` and `pnpm codegen`
4. **Implement processor**: Create indexing logic in `src/`
5. **Add configuration**: Update protocol configurations
6. **Add tests**: Include unit tests for new functionality
7. **Update documentation**: Document the new protocol support

### Database Changes

For database schema changes:

1. **Modify GraphQL schema**: Update `schema.graphql` files
2. **Generate TypeORM models**: Run `pnpm typegen`
3. **Create migration**: Run `pnpm migration:generate`
4. **Test migration**: Verify migration works correctly
5. **Document changes**: Update relevant documentation

### Documentation

When contributing:

- **Code comments**: Document complex logic and algorithms
- **README updates**: Update documentation for new features
- **Configuration examples**: Provide clear configuration examples
- **API documentation**: Document any API changes

### Code Review Process

All contributions go through code review:

1. **Automated checks**: CI runs linting, formatting, and tests
2. **Manual review**: Team members review code for quality and correctness
3. **Feedback incorporation**: Address review comments
4. **Approval and merge**: Changes are merged after approval

### Getting Help

If you need help while contributing:

- **Issues**: Check existing GitHub issues for similar problems
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Reference this README and inline code documentation
- **Community**: Reach out to maintainers for guidance

## FAQ: Rate Limiting and Data Flow in `adapters-api`

### What happens to data that is dropped with a 429 (rate-limited) response?

If an adapter receives a 429 response, it will keep retrying to send the data indefinitely. This ensures that no data is dropped due to rate limiting.

---

### Does the indexer know it needs to re-push dropped requests?

Yes. The indexer maintains a "position" (like a file pointer) and can resume from the last saved place after a crash or restart. This ensures all data is eventually pushed, even if some requests are rate-limited or interrupted.

---

### Is there a risk of data duplication?

Yes, if the indexer crashes and restarts, some data may be sent more than once. However, any potential duplication is handled by primary keys on the database tables, ensuring at-least-once delivery semantics.

---

### Who controls the speed at which the indexer pushes data to the adapters-api?

The indexer pushes data as fast as possible, but several factors can slow it down:

- Subsquid data fetching speed
- RPC call latency
- Internal processing logic
- External API call speed (if not batched)
- The adapters-api rate limiting (the main intentional slowdown)

The indexer will backfill as fast as it can, then switch to real-time indexing once caught up.

---

### What if the incoming data rate exceeds the rate limit?

The blockchain’s data generation speed is always slower than our rate limit, so this edge case does not occur.

### What delivery guarantees are provided?

- No data is dropped due to rate limiting; retries ensure eventual delivery.
- At-least-once delivery is guaranteed, and deduplication is handled by primary keys.
- The indexer is designed to recover from crashes and resume from the last processed position.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
