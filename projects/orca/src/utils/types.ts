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

interface Token {
  id: string;
  decimals: number;
}

interface PositionDetails {
  positionId: string;
  owner: string; // owner of the NFT (stand-alone) or owner of the bundle that contains this position
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  isActive: string;
  lastUpdatedBlockTs: number;
  lastUpdatedBlockHeight: number;
  poolId: string;
  positionMint: string;
  tokenProgram: string;
}

interface PositionBundleMeta {
  bundleId: string; // PDA / NFT mint of the bundle
  owner: string; // bundle NFT owner
  positionBundleMint: string;
  lastUpdatedBlockTs: number;
  lastUpdatedBlockHeight: number;
}

interface BundledPositionDetails extends PositionDetails {
  bundleId: string; // FK → PositionBundleMeta.bundleId
  bundleIndex: number; // slot inside the bundle
}

interface PositionBundleTransfer {
  bundleId: string;
  newOwner: string;
  previousOwner: string;
  slot: number;
  timestamp: number;
}

interface PoolDetails {
  poolId: string;
  whirlpoolConfig: any;
  token0Id: string;
  token1Id: string;
  token0Decimals: number;
  token1Decimals: number;
  fee: string;
  poolType: string;
  currentTick: number;
  tickSpacing: number;
  tokenProgram: string;
  systemProgram: string;
  tokenVault0: string;
  tokenVault1: string;
  funder: string;
}

interface SwapData extends BaseInstructionData {
  type: 'swap' | 'swapV2';
  transfers: any;
  // Add swap-specific fields here
}

interface TwoHopSwapData extends BaseInstructionData {
  type: 'twoHopSwap' | 'twoHopSwapV2';
  transfers: any;
  shouldRewardUser?: boolean; // Add this flag
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
    | 'openPositionWithMetadata'
    | 'resetPositionRange'
    | 'transferLockedPosition'
    | 'lockPosition';
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

interface BundledPositionData extends BaseInstructionData {
  type:
    | 'openBundledPosition'
    | 'closeBundledPosition'
    | 'initializePositionBundle'
    | 'initializePositionBundleWithMetadata'
    | 'deletePositionBundle';
  // Add bundled position-specific fields here
}

type OrcaInstructionData =
  | SwapData
  | TwoHopSwapData
  | LiquidityData
  | FeeData
  | RewardData
  | PositionData
  | InitializeData
  | TransferData
  | BundledPositionData;

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
  Token,
  PositionDetails,
  PositionBundleMeta,
  BundledPositionDetails,
  PositionBundleTransfer,
  PoolDetails,
  BundledPositionData,
};
