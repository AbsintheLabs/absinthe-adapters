import { readU8, readU32, readU64, readPk, U64Str, U32Str } from '../consts';
const bs58 = require('bs58');
interface Params {
  amountIn: U64Str;
  minimumAmountOut: U64Str;
}
interface SwapResult {
  actualInputAmount: U64Str;
  outputAmount: U64Str;
  nextSqrtPrice: U64Str;
  tradingFee: U64Str;
  protocolFee: U64Str;
  referralFee: U64Str;
}

export function decodeDbcSwapEvent(base58Data: string) {
  const raw = Buffer.from(bs58.default.decode(base58Data));
  if (raw.length < 16) throw new Error('Data too short');

  const payload = raw.subarray(16); // skip 8 ix + 8 event discriminators
  let o = 0;

  const pool = readPk(payload, o);
  o += 32;
  const config = readPk(payload, o);
  o += 32;
  const tradeDirection = readU8(payload, o);
  o += 1;
  const hasReferral = readU8(payload, o) === 1;
  o += 1;

  const pAmountIn = readU64(payload, o).toString();
  o += 8;
  const pMinOut = readU64(payload, o).toString();
  o += 8;
  const params: Params = { amountIn: pAmountIn, minimumAmountOut: pMinOut };

  const sActual = readU64(payload, o).toString();
  o += 8;
  const sOut = readU64(payload, o).toString();
  o += 8;
  const sNext = readU64(payload, o).toString();
  o += 8;
  const sRef = readU64(payload, o).toString();
  o += 8; // referralFee first
  const sTrade = readU64(payload, o).toString();
  o += 8; // tradingFee
  const sProt = readU64(payload, o).toString();
  o += 8; // protocolFee

  const swapResult: SwapResult = {
    actualInputAmount: sActual,
    outputAmount: sOut,
    nextSqrtPrice: sNext,
    tradingFee: sTrade,
    protocolFee: sProt,
    referralFee: sRef,
  };

  // tail fields: currentTimestamp then amountIn
  const currentTimestamp = readU64(payload, o).toString();
  o += 8;
  const amountIn = readU64(payload, o).toString();
  o += 8;

  return {
    pool,
    config,
    tradeDirection,
    hasReferral,
    params,
    swapResult,
    amountIn,
    currentTimestamp,
  };
}
