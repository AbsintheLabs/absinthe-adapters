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
import { event } from '../abi/abi.support';
import { CreatePrintrDbcEvent as CreatePrintrDbcEvent_ } from '../abi/diRTqkRxqg9fvQXemGosY8hg91Q7DpFqGXLJwG3bEDA/types';

import {
  Codec,
  address,
  array,
  bool,
  fixedArray,
  option,
  string,
  struct,
  u128,
  u16,
  u32,
  u64,
  u8,
} from '@subsquid/borsh';

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
  event: any;
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

interface SwapParameters {
  amountIn: bigint;
  minimumAmountOut: bigint;
}

const SwapParametersCodec: Codec<SwapParameters> = struct({
  amountIn: u64,
  minimumAmountOut: u64,
});

interface SwapResult {
  actualInputAmount: bigint;
  outputAmount: bigint;
  nextSqrtPrice: bigint;
  tradingFee: bigint;
  protocolFee: bigint;
  referralFee: bigint;
}

const SwapResultCodec: Codec<SwapResult> = struct({
  actualInputAmount: u64,
  outputAmount: u64,
  nextSqrtPrice: u128,
  tradingFee: u64,
  protocolFee: u64,
  referralFee: u64,
});

interface EvtSwapDbc {
  pool: string;
  config: string;
  tradeDirection: number;
  hasReferral: boolean;
  params: SwapParameters;
  swapResult: SwapResult;
  amountIn: bigint;
  currentTimestamp: bigint;
}

interface EvtSwapDamm {
  pool: string;
  tradeDirection: number;
  hasReferral: boolean;
  params: SwapParameters;
  swapResult: SwapResult;
  amountIn: bigint;
  currentTimestamp: bigint;
}

const EvtSwapDbcCodec: Codec<EvtSwapDbc> = struct({
  pool: address,
  config: address,
  tradeDirection: u8,
  hasReferral: bool,
  params: SwapParametersCodec,
  swapResult: SwapResultCodec,
  amountIn: u64,
  currentTimestamp: u64,
});

const EvtSwapDammCodec: Codec<EvtSwapDamm> = struct({
  pool: address,
  tradeDirection: u8,
  hasReferral: bool,
  params: SwapParametersCodec,
  swapResult: SwapResultCodec,
  amountIn: u64,
  currentTimestamp: u64,
});

const EvtSwapDbc = event(
  {
    d8: '0xda2a17a3d9e402dd',
  },
  EvtSwapDbcCodec,
);

const EvtSwapDamm = event(
  {
    d8: '0xea7c70e30c9e25d9',
  },
  EvtSwapDammCodec,
);

const CreatePrintrDbcEvent2 = event(
  {
    d8: '0xe06021507f14dbcb',
  },
  CreatePrintrDbcEvent_,
);

interface SwapData extends BaseInstructionData {
  type: 'swap';
}

interface CreatePrintrDbcEvent extends BaseInstructionData {
  type: 'CreatePrintrDbcEvent';
}

type PrintrInstructionData = SwapData | CreatePrintrDbcEvent;

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

export { EvtSwapDamm, CreatePrintrDbcEvent2, EvtSwapDbc, EvtSwapDbcCodec, EvtSwapDammCodec };
