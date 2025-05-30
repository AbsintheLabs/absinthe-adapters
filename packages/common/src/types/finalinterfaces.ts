interface TimeWeightedBalance {
    // versioning
    version: number; // semver. 1.0.0
    eventType: 'time_weighted_balance';

    // used as primary key and for deduplication
    eventId: string;  // often: md5(user + networkId + chainShortName + chainArch + startTs + endTs + apikeyid)

    // twb specific
    user: string;
    networkId: number;
    chainShortName: string;
    chainArch: 'evm'; // string
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    tokenName: string;

    // price feed
    priceFeedName?: string; // coingecko / static / codex / etc.
    tokenPriceUsd: number;
    tokenPriceUsdTimestampMs: number;

    balanceBefore: number;
    balanceAfter: number;
    amount: number;
    amountType: 'usd' | 'unscaled_token' | 'scaled_token'; // string
    timeWindowTrigger: 'transfer' | 'exhausted'; // string
    startTsMs: number;
    endTsMs: number;
    windowDurationMs: number;
    startBlocknumber?: string; // only for transfer
    endBlocknumber?: string; // only for transfer
    txHash?: string; // only for transfer

    // protocol metadata values + types for decoding
    // todo; for future want extendable schema registry so we have this be typed
    protocolMetadata1?: string;
    protocolMetadata1Type?: string;
    protocolMetadata2?: string;
    protocolMetadata2Type?: string;
    protocolMetadata3?: string;
    protocolMetadata3Type?: string;
    protocolMetadata4?: string;
    protocolMetadata4Type?: string;
    protocolMetadata5?: string;
    protocolMetadata5Type?: string;

    // runner specific
    runnerId: string; // docker/podman hostname. `echo $HOSTNAME`
}

interface Transaction {
    // versioning
    version: number;
    eventType: 'transaction';

    // used as primary key and for deduplication
    eventId: string;  // often: md5(user + networkId + chainShortName + chainArch + startTs + endTs + apikeyid)

    // transaction specific
    user: string;
    networkId: number;
    chainShortName: string;
    chainArch: 'evm'; // string
    amount: number;
    amountType: 'usd' | 'unscaled_token' | 'scaled_token'; // string
    timestampMs: number;
    txHash: string;
    logIndex: number;
    blockNumber: number;
    blockHash: string;

    // price feed
    priceFeedName?: string; // coingecko / static / codex / etc.
    tokenPriceUsd: number;
    tokenPriceUsdTimestampMs: number;

    // protocol metadata values + types for decoding
    // todo; for future want extendable schema registry so we have this be typed
    protocolMetadata1?: string;
    protocolMetadata1Type?: string;
    protocolMetadata2?: string;
    protocolMetadata2Type?: string;
    protocolMetadata3?: string;
    protocolMetadata3Type?: string;
    protocolMetadata4?: string;
    protocolMetadata4Type?: string;
    protocolMetadata5?: string;
    protocolMetadata5Type?: string;

    // runner specific
    runnerId: string; // docker/podman hostname. `echo $HOSTNAME`
}

// used by the ABS-API to append metadata to the data that is coming in (not used by client indexers) 
interface createdByAPI {
    timestampRecv: number; // ISO 8601 timestamp
    clientId: string; // fetches uuid from the api key hash table
    clientName: string; // fetches name for the client (human readability). // warn: do we need this?
}
