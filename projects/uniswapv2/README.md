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

Please refer to the main setup.
You can consider -

```
 "dexProtocols": [
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
    },
    {
      "type": "izumi",
      "chainId": 42161,
      "toBlock": 0,
      "protocols": [
        {
          "name": "weth-hemitbtc",
          "contractAddress": "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
          "fromBlock": 1276815,
          "pricingStrategy": "coingecko",
          "token0": {
            "coingeckoId": "weth",
            "decimals": 18
          },
          "token1": {
            "coingeckoId": "btc",
            "decimals": 8
          },
          "preferredTokenCoingeckoId": "token1"
        },
        {
          "name": "vusd-weth",
          "contractAddress": "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
          "fromBlock": 1274620,
          "pricingStrategy": "coingecko",
          "token0": {
            "coingeckoId": "vesper-vdollar",
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
  ],
```

# Explaination of env variables

- RPC_URL: The URL of the blockchain RPC endpoint
- ABSINTHE_API_URL: The URL of the Absinthe API endpoint
- ABSINTHE_API_KEY: The API key for the Absinthe API
- COINGECKO_API_KEY: The API key for the Coingecko API
- DB_NAME: The name of the database
- DB_PORT: The port of the database
- DB_URL: The URL of the database
- LOG_FILE_PATH: The path to the log file

# How to get the env variables

## RPC_URL

**Purpose**: Connects your indexer to the blockchain network via RPC (Remote Procedure Call) endpoint.

**Capabilities**:

- Read blockchain data (blocks, transactions, events)
- Query smart contract states
- Listen for real-time blockchain events

**How to get**:

1. **Alchemy** (Recommended):

   - Visit [alchemy.com](https://alchemy.com)
   - Create a free account
   - Create a new app for your target network
   - Copy the HTTPS endpoint

2. **Infura**:
   - Visit [infura.io](https://infura.io)
   - Sign up and create a project
   - Get your project endpoint

**Example values**:

```
# Ethereum mainnet
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Optimism
RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Base
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
```

---

## ABSINTHE_API_URL & ABSINTHE_API_KEY

**Purpose**: Connects to the Absinthe API service for data transmission and retrieval.

**How to get**:

> ⚠️ **Note**: API key provisioning procedure is currently pending. Contact the Absinthe team for access.

**Default URL**:

```
ABSINTHE_API_URL=https://adapters.absinthe.network
```

---

## COINGECKO_API_KEY

**Purpose**: Fetches cryptocurrency price data from CoinGecko's API.

**How to get**:

1. Visit [coingecko.com/en/api](https://coingecko.com/en/api)
2. Sign up for a free account
3. Navigate to your dashboard
4. Generate an API key

**Pricing tiers**:

- **Free tier**:
  - 10,000 requests/month
  - Basic price data access
- **Paid tiers**:
  - Higher rate limits
  - Historical data access
  - Priority support

---

## Database Configuration (DB_NAME, DB_PORT, DB_URL)

**Purpose**: PostgreSQL database connection settings for storing indexed data.

### Local Development

If running the indexer locally:

```
DB_URL=postgresql://postgres:postgres@localhost:5432/postgres
DB_NAME=postgres
DB_PORT=5432
```

### Docker Compose

If using docker-compose:

```
DB_URL=postgresql://postgres:postgres@postgres:5432/postgres
DB_NAME=postgres
DB_PORT=5432
```

### Production Database

**How to get**:

1. **Self-hosted PostgreSQL**:

   - Install PostgreSQL from [postgresql.org](https://postgresql.org)
   - Create a database and user
   - Configure connection string

2. **Cloud providers**:
   - **Heroku Postgres**: Add Heroku Postgres addon
   - **Supabase**: Create project at [supabase.com](https://supabase.com)

---

## LOG_FILE_PATH

**Purpose**: Specifies where application logs should be written.

**Example values**:

```
# Local development
LOG_FILE_PATH=./logs/indexer.log

# Production
LOG_FILE_PATH=/var/log/uniswap-indexer/app.log
```

**Setup**:

1. Create the log directory:
   ```bash
   mkdir -p logs
   ```
2. Ensure write permissions for the application

## Configuration Setup

### Prerequisites

- Node.js (v20+)
- pnpm

### Step 1: Environment Variables Setup

First, copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific values. See the [Environment Configuration](#environment-configuration) section above for detailed instructions on obtaining each required variable.

### Step 2: Protocol Configuration Setup

The indexer uses a JSON configuration file to define which protocols and pools to track.

```bash
cp abs_config.example.json abs_config.json
```

Edit `abs_config.json` to match your indexing requirements:

#### Core Settings

- **`chainId`**: The blockchain network ID (1 for Ethereum mainnet)
- **`gatewayUrl`**: Subsquid gateway URL for your target network
- **`balanceFlushIntervalHours`**: How often to create balance snapshots (in hours)
- **`toBlock`**: Optional ending block number for indexing

#### Protocol Configuration

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

### Step 4: Validation

The indexer automatically validates both your environment variables and configuration file on startup. If there are any issues, you'll see detailed error messages indicating what needs to be fixed.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/printr-adapter?referralCode=Nsq9l9)

### Next Steps

Once you have both files configured:

1. Your `.env` file with all required environment variables
2. Your `abs_config.json` file with protocol configurations

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

### Testing

While comprehensive tests are still being developed, when writing tests:

- **Unit tests**: Test individual functions and components
- **Integration tests**: Test interaction between components
- **E2E tests**: Test complete indexing workflows
- **Mock external APIs**: Use mocks for external dependencies

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

## License

This project is licensed under the MIT License - see the LICENSE file for details.
