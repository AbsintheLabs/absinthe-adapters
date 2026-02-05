import { readU8, readU32, readU64, readPk, U64Str, U32Str } from '../consts';
const bs58 = require('bs58');
export interface DammParams {
  amount0: U64Str;
  amount1: U64Str;
  swapMode: number;
  amountIn: U64Str;
}
export interface DammSwapResult {
  includedFeeInputAmount: U64Str;
  excludedFeeInputAmount: U64Str;
  amountLeft: U64Str;
  outputAmount: U64Str;
  nextSqrtPrice: U64Str;
  tradingFee: U64Str;
  protocolFee: U64Str;
  partnerFee: U64Str;
  referralFee: U64Str;
}
export interface DammSelfCpiEvent {
  pool: string;
  tradeDirection: number;
  collectFeeMode: number;
  hasReferral: boolean;
  params: DammParams;
  swapResult: DammSwapResult;
  includedTransferFeeAmountIn: U64Str;
  includedTransferFeeAmountOut: U64Str;
  excludedTransferFeeAmountOut: U64Str;
  currentTimestamp: U32Str;
  reserveAAmount: U64Str;
  reserveBAmount: U64Str;
}

export function decodeDammV2SelfCpiLog(base58Data: string): DammSelfCpiEvent {
  const raw = Buffer.from(bs58.default.decode(base58Data));
  if (raw.length < 16) throw new Error('Data too short');
  const payload = raw.subarray(16);

  let o = 0;
  const pool = readPk(payload, o);
  o += 32;
  const tradeDirection = readU8(payload, o);
  o += 1;
  const collectFeeMode = readU8(payload, o);
  o += 1;
  const hasReferral = readU8(payload, o) === 1;
  o += 1;

  // params: amount0 (u64), amount1 (u64), swapMode (u8)
  const amount0 = readU64(payload, o);
  const amount1 = readU64(payload, o + 8);
  const swapMode = readU8(payload, o + 16);
  o += 17; // 8 + 8 + 1

  // swapResult: 9 fields
  const includedFeeInputAmount = readU64(payload, o);
  o += 8;
  const excludedFeeInputAmount = readU64(payload, o);
  o += 8;
  const amountLeft = readU64(payload, o);
  o += 8;
  const outputAmount = readU64(payload, o);
  o += 8;
  const nextSqrtPrice = readU64(payload, o);
  o += 8;
  const tradingFee = readU64(payload, o);
  o += 8;
  const protocolFee = readU64(payload, o);
  o += 8;
  const partnerFee = readU64(payload, o);
  o += 8;
  const referralFee = readU64(payload, o);
  o += 8;

  // Option B: amountIn = swapResult.includedFeeInputAmount (canonical input, includes fees)
  const params: DammParams = {
    amount0,
    amount1,
    swapMode,
    amountIn: includedFeeInputAmount,
  };

  // transfer fee amounts
  const includedTransferFeeAmountIn = readU64(payload, o);
  o += 8;
  const includedTransferFeeAmountOut = readU64(payload, o);
  o += 8;
  const excludedTransferFeeAmountOut = readU64(payload, o);
  o += 8;

  // currentTimestamp (u32 + 4 padding)
  const currentTimestamp = readU32(payload, o);
  o += 8;

  // reserves
  const reserveAAmount = readU64(payload, o);
  o += 8;
  const reserveBAmount = readU64(payload, o);
  o += 8;

  return {
    pool,
    tradeDirection,
    collectFeeMode,
    hasReferral,
    params,
    swapResult: {
      includedFeeInputAmount,
      excludedFeeInputAmount,
      amountLeft,
      outputAmount,
      nextSqrtPrice,
      tradingFee,
      protocolFee,
      partnerFee,
      referralFee,
    },
    includedTransferFeeAmountIn,
    includedTransferFeeAmountOut,
    excludedTransferFeeAmountOut,
    currentTimestamp,
    reserveAAmount,
    reserveBAmount,
  };
}
