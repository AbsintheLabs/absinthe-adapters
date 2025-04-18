# Showcase squid 01: USDC transfers in real time

This squid captures all `Transfer(address,address,uint256)` events emitted by the [USDC token contract](https://etherscan.io/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) and keeps up with network updates [in real time](https://docs.subsquid.io/basics/unfinalized-blocks/). See more examples of requesting data with squids on the [showcase page](https://docs.subsquid.io/evm-indexing/configuration/showcase) of Subsquid documentation.

Dependencies: Node.js, Docker.

## Quickstart

```bash
# 0. Install @subsquid/cli a.k.a. the sqd command globally
npm i -g @subsquid/cli

# 1. Retrieve the template
sqd init showcase01 -t https://github.com/subsquid-labs/showcase01-all-usdc-transfers
cd showcase01

# 2. Install dependencies
npm ci

# 3. Start a Postgres database container and detach
sqd up

# 4. Build and start the processor
sqd process

# 5. The command above will block the terminal
#    being busy with fetching the chain data, 
#    transforming and storing it in the target database.
#
#    To start the graphql server open the separate terminal
#    and run
sqd serve
```
A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

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