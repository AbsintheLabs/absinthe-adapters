import { readU8, readU32, readU64, readPk, U64Str, U32Str } from '../consts';
const bs58 = require('bs58');
export interface DammParams {
  amountIn: U64Str;
  minimumAmountOut: U64Str;
}
export interface DammSwapResult {
  outputAmount: U64Str;
  nextSqrtPrice: U64Str;
  lpFee: U64Str;
  protocolFee: U64Str;
  partnerFee: U64Str;
  referralFee: U64Str;
}
export interface DammSelfCpiEvent {
  pool: string;
  tradeDirection: number;
  hasReferral: boolean;
  params: DammParams;
  swapResult: DammSwapResult;
  actualAmountIn: U64Str;
  currentTimestamp: U32Str;
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
  const hasReferral = readU8(payload, o) === 1;
  o += 1;

  // params
  const params: DammParams = {
    amountIn: readU64(payload, o), // u64
    minimumAmountOut: readU64(payload, o + 8), // u64
  };
  o += 16;

  // swapResult: outputAmount, nextSqrtPrice, partnerFee, lpFee, protocolFee, referralFee
  const outputAmount = readU64(payload, o);
  o += 8;
  const nextSqrtPrice = readU64(payload, o);
  o += 8;
  const partnerFee = readU64(payload, o);
  o += 8;
  const lpFee = readU64(payload, o);
  o += 8;
  const protocolFee = readU64(payload, o);
  o += 8;
  const referralFee = readU64(payload, o);
  o += 8;

  // tail: currentTimestamp (u32 + 4 pad) -> actualAmountIn (u64)
  const currentTimestamp = readU32(payload, o);
  o += 8; // 4 value + 4 padding
  const actualAmountIn = readU64(payload, o);
  o += 8;

  return {
    pool,
    tradeDirection,
    hasReferral,
    params,
    swapResult: { outputAmount, nextSqrtPrice, lpFee, protocolFee, partnerFee, referralFee },
    actualAmountIn,
    currentTimestamp,
  };
}
