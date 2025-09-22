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

interface PrintrMeteoraProtocol {
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
  printrMeteoraProtocol: PrintrMeteoraProtocol;
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
  type: 'swap';
}

type PrintrInstructionData = SwapData;

export type {
  TokenBalance,
  PrintrMeteoraProtocol,
  ValidatedEnv,
  ProtocolStateOrca,
  PrintrInstructionData,
  SwapData,
  BaseInstructionData,
  Token,
  PositionDetails,
  PositionBundleMeta,
  BundledPositionDetails,
  PositionBundleTransfer,
  PoolDetails,
};
