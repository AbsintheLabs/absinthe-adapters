import {
  ChainId,
  ChainShortName,
  ChainType,
  ProtocolType,
  ChainName,
  GatewayUrl,
  ValidatedEnvBase,
  HistoryWindow,
  Transaction,
} from '@absinthe/common';

interface TokenBalance {
  id: string;
  transactionIndex: number;
  account: string;
  preMint: string;
  postMint: string;
  preDecimals: number;
  postDecimals: number;
  preOwner: string;
  postOwner: string;
  preAmount: bigint;
  postAmount: bigint;
}

interface OrcaProtocol {
  type: string;
  balanceFlushIntervalHours: number;
  chainId: ChainId;
  chainShortName: ChainShortName;
  chainName: ChainName;
  chainArch: ChainType;
  gatewayUrl: GatewayUrl;
  rpcUrl: string;
  toBlock: number;
  fromBlock: number;
  name: string;
  contractAddress: string;
}

interface ValidatedEnv {
  baseConfig: ValidatedEnvBase;
  orcaProtocol: OrcaProtocol;
}

// New types for the modular architecture
interface ProtocolStateOrca {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

interface BaseInstructionData {
  type: string;
  slot: number;
  txHash: string;
  logIndex: number | null;
  blockHash: string;
  timestamp: number;
  decodedInstruction: any;
  tokenBalances: TokenBalance[];
}

interface SwapData extends BaseInstructionData {
  type: 'swap' | 'swapV2';
  // Add swap-specific fields here
}

interface TwoHopSwapData extends BaseInstructionData {
  type: 'twoHopSwap' | 'twoHopSwapV2';
  // Add two-hop swap specific fields here
}

interface LiquidityData extends BaseInstructionData {
  type: 'increaseLiquidity' | 'decreaseLiquidity' | 'increaseLiquidityV2' | 'decreaseLiquidityV2';
  // Add liquidity-specific fields here
}

interface FeeData extends BaseInstructionData {
  type: 'collectFees' | 'collectProtocolFees' | 'collectFeesV2' | 'collectProtocolFeesV2';
  // Add fee-specific fields here
}

interface RewardData extends BaseInstructionData {
  type: 'collectReward' | 'collectRewardV2';
  // Add reward-specific fields here
}

interface PositionData extends BaseInstructionData {
  type:
    | 'openPosition'
    | 'closePosition'
    | 'openPositionWithTokenExtensions'
    | 'closePositionWithTokenExtensions'
    | 'openPositionWithMetadata';
  // Add position-specific fields here
}

interface TransferData extends BaseInstructionData {
  type: 'transfer' | 'transferChecked';
  // Add transfer-specific fields here
}

interface InitializeData extends BaseInstructionData {
  type: 'initializePoolV2' | 'initializePool' | 'initializePoolWithAdaptiveFee';
  // Add initialize-specific fields here
}

type OrcaInstructionData =
  | SwapData
  | TwoHopSwapData
  | LiquidityData
  | FeeData
  | RewardData
  | PositionData
  | InitializeData
  | TransferData;

export type {
  TokenBalance,
  OrcaProtocol,
  ValidatedEnv,
  ProtocolStateOrca,
  OrcaInstructionData,
  SwapData,
  TwoHopSwapData,
  LiquidityData,
  FeeData,
  RewardData,
  PositionData,
  InitializeData,
  BaseInstructionData,
};
