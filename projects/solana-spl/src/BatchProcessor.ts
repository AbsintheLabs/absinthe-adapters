import { AbsintheApiClient } from '@absinthe/common';
import {
  ActiveBalance,
  Chain,
  HistoryWindow,
  TimeWeightedBalanceEvent,
  ValidatedEnvBase,
} from '@absinthe/common';
import { ValidatedSolanaSplProtocolConfig } from '@absinthe/common';
import {
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  ProtocolType,
  Currency,
  TimeWindowTrigger,
} from '@absinthe/common';
import {
  fetchHistoricalUsd,
  processValueChangeBalances,
  toTimeWeightedBalance,
  mapToJson,
  jsonToMap,
  pricePosition,
} from '@absinthe/common';
import { BATCH_SIZE } from '@absinthe/common';
import { logger } from '@absinthe/common';
import { dataSource, SolanaBlock } from './processor';
import * as fs from 'fs';
import * as path from 'path';

interface TokenMetadata {
  symbol: string;
  decimals: number;
  coingeckoId?: string;
}

export class SolanaSplProcessor {
  private protocol: ValidatedSolanaSplProtocolConfig;
  private apiClient: AbsintheApiClient;
  private tokenMetadata: Map<string, TokenMetadata>;
  private baseConfig: ValidatedEnvBase;
  private activeBalances: Map<string, Map<string, ActiveBalance>> = new Map();
  private stateFilePath: string;
  private lastBlockNumber: number = 0;
  private lastBlockTimeMs: number = 0;
  private lastPersistHourBucket: number = -1;
  private priceCache: Map<string, Map<number, number>> = new Map();
  private walletBlacklist: Set<string> = new Set();
  private readonly chain: Chain = {
    chainArch: ChainType.SOLANA,
    networkId: ChainId.SOLANA,
    chainShortName: ChainShortName.SOLANA,
    chainName: ChainName.SOLANA,
  };
  private readonly flushIntervalMs: number;
  private pendingEvents: TimeWeightedBalanceEvent[] = [];
  private lastApiFlushMs = 0;
  private readonly batchFlushIntervalMs = 2000; // flush at least every 2s

  constructor(
    protocol: ValidatedSolanaSplProtocolConfig,
    apiClient: AbsintheApiClient,
    baseConfig: ValidatedEnvBase,
  ) {
    this.protocol = protocol;
    this.apiClient = apiClient;
    this.baseConfig = baseConfig;
    this.tokenMetadata = new Map();
    const defaultStatePath = path.join(
      process.cwd(),
      'projects',
      'solana-spl',
      'logs',
      'state.json',
    );
    this.stateFilePath = process.env.SPL_STATE_PATH || defaultStatePath;
    this.flushIntervalMs = this.baseConfig.balanceFlushIntervalHours * 60 * 60 * 1000;
    this.initializeTokenMetadata();
    this.initializeWalletBlacklist();
    this.loadState();
  }

  private async flushExhausted(block: SolanaBlock): Promise<void> {
    const blockNumber = block.header.slot;
    const blockTimeSec = (block.header as any).blockTime ?? (block as any).timestamp;
    const nowMs = blockTimeSec ? Number(blockTimeSec) * 1000 : Date.now();
    await this.flushExhaustedAt(nowMs, blockNumber);
  }

  private async flushExhaustedAt(nowMs: number, blockNumber: number): Promise<void> {
    const flushMs = this.flushIntervalMs;

    const allEvents: TimeWeightedBalanceEvent[] = [];

    for (const [mintAddress, balances] of this.activeBalances.entries()) {
      const tokenInfo = this.tokenMetadata.get(mintAddress);
      if (!tokenInfo) continue;

      const tokenPrice = await this.getTokenPrice(tokenInfo, nowMs);
      const tokens = this.buildTokenFields(tokenInfo, mintAddress);

      const windows: HistoryWindow[] = [];
      for (const [user, state] of balances.entries()) {
        const isBlacklisted = this.walletBlacklist.has(user);
        if (state.balance > 0n && nowMs - state.updatedBlockTs >= flushMs) {
          const windowCandidate: HistoryWindow = {
            userAddress: user,
            deltaAmount: 0,
            trigger: TimeWindowTrigger.EXHAUSTED,
            startTs: state.updatedBlockTs,
            endTs: nowMs,
            startBlockNumber: state.updatedBlockHeight,
            endBlockNumber: blockNumber,
            txHash: null,
            windowDurationMs: flushMs,
            tokenPrice: tokenPrice,
            tokenDecimals: tokenInfo.decimals,
            valueUsd: pricePosition(tokenPrice, state.balance, tokenInfo.decimals),
            balanceBefore: state.balance.toString(),
            balanceAfter: state.balance.toString(),
            currency: Currency.USD,
            tokens,
            type: 'exhausted',
          };
          if (!isBlacklisted) {
            windows.push(windowCandidate);
          }
          state.updatedBlockTs = nowMs;
          state.updatedBlockHeight = blockNumber;
        }
      }

      if (windows.length > 0) {
        const protocolForEvent = {
          type: ProtocolType.SOLANA_SPL,
          name: this.protocol.name,
          contractAddress: mintAddress,
        } as any;
        const events = toTimeWeightedBalance(
          windows,
          protocolForEvent,
          this.baseConfig,
          this.chain,
        );
        allEvents.push(...events);
      }
    }

    if (allEvents.length > 0) {
      this.enqueueAndMaybeFlush(allEvents, nowMs);
    }
  }

  public async flushOnShutdown(): Promise<void> {
    const nowMs = Date.now();
    const blockNumber = this.lastBlockNumber || 0;
    try {
      await this.flushExhaustedAt(nowMs, blockNumber);
      await this.flushPending(true);
    } catch (e) {
      logger.warn('Error while flushing on shutdown', e);
    }
    this.persistStateSafely();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8');
        const json = JSON.parse(raw);
        for (const [mint, mapJson] of Object.entries(json)) {
          const perToken = jsonToMap(mapJson as any);
          this.activeBalances.set(mint, perToken);
        }
        logger.info('Restored active balances state from disk');
      }
    } catch (e) {
      logger.warn('Failed to restore state; starting fresh', e);
    }
  }

  private persistStateSafely(): void {
    try {
      const out: Record<string, any> = {};
      for (const [mint, map] of this.activeBalances.entries()) {
        out[mint] = mapToJson(map);
      }
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFilePath, JSON.stringify(out));
    } catch (e) {
      logger.warn('Failed to persist state to disk', e);
    }
  }
  private initializeTokenMetadata(): void {
    try {
      // Read token metadata from abs_config.json
      const configPath = path.join(process.cwd(), 'abs_config.json');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Initialize metadata strictly from config
      if (config.solanaSplProtocols && Array.isArray(config.solanaSplProtocols)) {
        config.solanaSplProtocols.forEach((protocol: any) => {
          if (protocol.mintAddress && protocol.name && protocol.token) {
            this.tokenMetadata.set(protocol.mintAddress, {
              symbol: protocol.name.toUpperCase(),
              decimals: protocol.token.decimals || 6,
              coingeckoId: protocol.token.coingeckoId,
            });
          }
        });
      }

      logger.info(`Initialized metadata for ${this.tokenMetadata.size} tokens`);
    } catch (error) {
      logger.warn(
        'Failed to load token metadata from config; no tokens will be tracked here:',
        error,
      );
    }
  }

  async run(): Promise<void> {
    logger.info(`Starting Solana SPL processor for ${this.protocol.name}`);
    logger.info(
      `Tracking ${this.tokenMetadata.size} tokens: ${Array.from(this.tokenMetadata.values())
        .map((t) => t.symbol)
        .join(', ')}`,
    );

    try {
      // Get the current finalized height
      const finalizedHeight = await dataSource.getFinalizedHeight();
      logger.info(`Current finalized height: ${finalizedHeight}`);

      // Start processing from the configured block
      const fromBlock = this.protocol.fromBlock;
      logger.info(`Processing from block ${fromBlock} to ${finalizedHeight}`);

      // Get block stream and process
      const blockStream = dataSource.getBlockStream(fromBlock);

      for await (const blocks of blockStream) {
        await this.processBlocks(blocks);
        await this.flushExhausted(blocks[blocks.length - 1]);
        await this.maybePersistHourly(this.lastBlockTimeMs || Date.now());
      }
    } catch (error) {
      logger.error('Error in Solana SPL processor:', error);
      throw error;
    }
  }

  private async processBlocks(blocks: SolanaBlock[]): Promise<void> {
    for (const block of blocks) {
      await this.processBlock(block);
    }
  }

  private async processBlock(block: SolanaBlock): Promise<void> {
    const blockNumber = block.header.slot;
    const blockTimeSec = (block.header as any).blockTime ?? (block as any).timestamp;
    const blockTimestampMs = blockTimeSec ? Number(blockTimeSec) * 1000 : Date.now();
    this.lastBlockNumber = blockNumber;
    this.lastBlockTimeMs = blockTimestampMs;
    const tokenBalanceCount = block.tokenBalances.length;

    if (tokenBalanceCount === 0) return;

    logger.info(`Processing block ${blockNumber} with ${tokenBalanceCount} token balance changes`);

    // Group token balance changes by token for better organization
    const tokenChanges = new Map<string, any[]>();

    for (const tokenBalance of block.tokenBalances) {
      if (this.isRelevantTokenBalance(tokenBalance)) {
        const mint = tokenBalance.postMint || tokenBalance.preMint;
        if (mint && !tokenChanges.has(mint)) {
          tokenChanges.set(mint, []);
        }
        if (mint) {
          tokenChanges.get(mint)!.push(tokenBalance);
        }
      }
    }

    const allEvents: TimeWeightedBalanceEvent[] = [];
    for (const [mint, changes] of tokenChanges) {
      const tokenInfo = this.tokenMetadata.get(mint);
      if (!tokenInfo) continue;
      logger.info(`Processing ${changes.length} changes for ${tokenInfo.symbol} (${mint})`);
      for (const change of changes) {
        const events = await this.processTokenBalanceChange(
          change,
          blockNumber,
          blockTimestampMs,
          mint,
          tokenInfo,
        );
        allEvents.push(...events);
      }
    }

    if (allEvents.length > 0) {
      this.enqueueAndMaybeFlush(allEvents, blockTimestampMs);
    }
  }

  private isRelevantTokenBalance(tokenBalance: any): boolean {
    // Check if this token balance change is for any of our tracked tokens
    const mint = tokenBalance.postMint || tokenBalance.preMint;
    return mint && this.tokenMetadata.has(mint);
  }

  private async processTokenBalanceChange(
    tokenBalance: any,
    blockNumber: number,
    blockTimestampMs: number,
    mintAddress: string,
    tokenInfo: TokenMetadata,
  ): Promise<TimeWeightedBalanceEvent[]> {
    try {
      const preOwner = tokenBalance.preOwner;
      const postOwner = tokenBalance.postOwner;
      const preAmount = tokenBalance.preAmount;
      const postAmount = tokenBalance.postAmount;

      const preBalance = BigInt(preAmount || '0');
      const postBalance = BigInt(postAmount || '0');
      const balanceChange = postBalance - preBalance;

      const formatAmount = (amount: bigint, decimals: number) => {
        const divisor = BigInt(10) ** BigInt(decimals);
        const whole = amount / divisor;
        const fraction = amount % divisor;
        return `${whole}.${fraction.toString().padStart(decimals, '0')}`;
      };

      const preFormatted = formatAmount(preBalance, tokenInfo.decimals);
      const postFormatted = formatAmount(postBalance, tokenInfo.decimals);
      const changeFormatted = formatAmount(
        balanceChange > 0n ? balanceChange : -balanceChange,
        tokenInfo.decimals,
      );

      const changeType =
        balanceChange > 0n ? 'INCREASE' : balanceChange < 0n ? 'DECREASE' : 'NO_CHANGE';
      const changeDirection = balanceChange > 0n ? '↗️' : balanceChange < 0n ? '↘️' : '➡️';

      logger.debug(
        `${tokenInfo.symbol} balance change at block ${blockNumber}: ${changeDirection} ${changeType} ` +
          `${preOwner} -> ${postOwner}, ${preFormatted} -> ${postFormatted} (Δ: ${changeFormatted})`,
      );

      if (balanceChange === 0n) return [];

      let from = '';
      let to = '';
      if (preOwner && postOwner && preOwner !== postOwner) {
        if (balanceChange > 0n) {
          to = postOwner;
          from = preOwner;
        } else {
          to = preOwner;
          from = postOwner;
        }
      } else if (postOwner) {
        if (balanceChange > 0n) {
          to = postOwner;
        } else {
          from = postOwner;
        }
      }

      const tokenPrice = await this.getTokenPrice(tokenInfo, blockTimestampMs);
      const tokens = this.buildTokenFields(tokenInfo, mintAddress);

      const windows = processValueChangeBalances({
        from,
        to,
        amount: balanceChange < 0n ? -balanceChange : balanceChange,
        usdValue: 0,
        blockTimestamp: blockTimestampMs,
        blockHeight: blockNumber,
        txHash: '',
        activeBalances: this.activeBalances,
        windowDurationMs: this.flushIntervalMs,
        tokenPrice,
        tokenDecimals: tokenInfo.decimals,
        tokenAddress: mintAddress,
        tokens,
      });

      // Adjust valueUsd for each window based on active balance and tokenPrice
      const filtered = windows.filter((w) => !this.walletBlacklist.has(w.userAddress));
      for (const w of filtered) {
        const balance = BigInt(w.balanceBefore);
        w.valueUsd = pricePosition(tokenPrice, balance, tokenInfo.decimals);
      }

      if (filtered.length === 0) return [];
      const protocolForEvent = {
        type: ProtocolType.SOLANA_SPL,
        name: this.protocol.name,
        contractAddress: mintAddress,
      } as any;
      const events = toTimeWeightedBalance(filtered, protocolForEvent, this.baseConfig, this.chain);
      return events;
    } catch (error) {
      logger.error(
        `Error processing ${tokenInfo.symbol} token balance change at block ${blockNumber}:`,
        error,
      );
      return [];
    }
  }

  private async maybePersistHourly(nowMs: number): Promise<void> {
    const currentHourBucket = Math.floor(nowMs / (60 * 60 * 1000));
    if (currentHourBucket !== this.lastPersistHourBucket) {
      this.persistStateSafely();
      this.lastPersistHourBucket = currentHourBucket;
    }
  }

  private async getCachedUsd(coingeckoId: string, tsMs: number): Promise<number> {
    const hourBucket = Math.floor(tsMs / (60 * 60 * 1000));
    let byHour = this.priceCache.get(coingeckoId);
    if (!byHour) {
      byHour = new Map<number, number>();
      this.priceCache.set(coingeckoId, byHour);
    }
    const cached = byHour.get(hourBucket);
    if (typeof cached === 'number') return cached;

    const price = await fetchHistoricalUsd(coingeckoId, tsMs, this.baseConfig.coingeckoApiKey);
    byHour.set(hourBucket, price);
    return price;
  }

  private async getTokenPrice(tokenInfo: TokenMetadata, tsMs: number): Promise<number> {
    if (!tokenInfo.coingeckoId) return 0;
    return this.getCachedUsd(tokenInfo.coingeckoId, tsMs);
  }

  private buildTokenFields(tokenInfo: TokenMetadata, mintAddress: string) {
    return {
      symbol: { value: tokenInfo.symbol, type: 'string' },
      mint: { value: mintAddress, type: 'string' },
    } as any;
  }

  private enqueueAndMaybeFlush(events: TimeWeightedBalanceEvent[], nowMs: number): void {
    this.pendingEvents.push(...events);
    const shouldFlushBySize = this.pendingEvents.length >= BATCH_SIZE;
    const shouldFlushByTime = nowMs - this.lastApiFlushMs >= this.batchFlushIntervalMs;
    if (shouldFlushBySize || shouldFlushByTime) {
      this.flushPending().catch((e) => logger.warn('Failed to flush pending events', e));
      this.lastApiFlushMs = nowMs;
    }
  }

  private async flushPending(force = false): Promise<void> {
    if (!force && this.pendingEvents.length === 0) return;
    const toSend = this.pendingEvents.splice(0, this.pendingEvents.length);
    if (toSend.length === 0) return;
    await this.apiClient.send(toSend);
  }

  private initializeWalletBlacklist(): void {
    try {
      const configPath = path.join(process.cwd(), 'abs_config.json');
      if (!fs.existsSync(configPath)) return;
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      const list: string[] = Array.isArray(config.solanaSplWalletBlacklist)
        ? config.solanaSplWalletBlacklist
        : [];
      this.walletBlacklist = new Set(list);
      if (this.walletBlacklist.size > 0) {
        logger.info(
          `Initialized Solana SPL wallet blacklist with ${this.walletBlacklist.size} addresses`,
        );
      }
    } catch (e) {
      logger.warn('Failed to initialize wallet blacklist:', e);
    }
  }

  getTokenInfo(mintAddress: string): TokenMetadata | undefined {
    return this.tokenMetadata.get(mintAddress);
  }

  getTrackedTokenSymbols(): string[] {
    return Array.from(this.tokenMetadata.values()).map((t) => t.symbol);
  }

  isTrackingToken(mintAddress: string): boolean {
    return this.tokenMetadata.has(mintAddress);
  }
}
