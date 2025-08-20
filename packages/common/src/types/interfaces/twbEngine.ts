import { PriceService } from '../../services/PricingService';
import { TokenMetadata } from './interfaces';

interface BlockData {
  ts: number;
  height: number;
  txHash: string | null;
}

interface TwbEngineConfig {
  enablePriceCache: boolean;

  // Add token validation configuration
  tokenValidation?: {
    enabled: boolean;
    tokenMetadataList: TokenMetadata[];
    tokenChecker?: (tokenAddress: string) => TokenMetadata | null;
  };
  // Add pricing configuration
  pricing?: {
    enabled: boolean;
    priceService?: PriceService;
    coingeckoApiKey?: string;
  };
}

export { BlockData, TwbEngineConfig };
