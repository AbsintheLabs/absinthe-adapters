## Install

```bash
# 0. Install @subsquid/cli a.k.a. the sqd command globally
npm i -g @subsquid/cli

# 2. Install dependencies
npm ci

# 3. Start a Postgres database container and detach
sqd up

# 4. Build and start the processor
sqd process
```

## Process

1. Copy ABI into the abi folder
2. Run `npx squid-evm-typegen src/abi ./abi/<your abi>.json` to generate the typescript generated abi
3.

---

### Data Tests We'll Need

#### Token Balances Query

1. start and end timestamps are not equal to each other
2. end timestamp is not before start timestamp
3. non 0 token balance for output rows

### Open Questions

Where do the data tests run? Does this also indicate health of the service?

### Health Services We'll Need

1. Throughput: rows per hour
2. Last update time
3. Data Tests / Quality status (how many rows fail)
4. When the last pseudo-update was (not transfer)
5. At what timestamp we start seeing data (from contract deployment or implementation)
6. If there are holes in the data? (what does this mean)
