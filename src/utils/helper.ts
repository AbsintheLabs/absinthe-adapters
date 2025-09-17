type ActiveBalance = {
  balance: bigint;
  updatedBlockTs: number;
  updatedBlockHeight: number;
};
// import { TOKEN_METADATA } from './conts';
import { log } from './logger.ts';
import { createHash } from 'crypto';

function flattenNestedMap(
  nestedMap: Map<string, Map<string, ActiveBalance>>,
): Map<string, ActiveBalance> {
  const flatMap = new Map<string, ActiveBalance>();
  for (const [tokenAddress, userBalances] of nestedMap.entries()) {
    for (const [userAddress, balance] of userBalances.entries()) {
      flatMap.set(`${tokenAddress}-${userAddress}`, balance);
    }
  }
  return flatMap;
}

export function md5Hash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

// function checkToken(token: string): TokenMetadata | null {
//   let tokenMetadata = TOKEN_METADATA.find((t) => t.address.toLowerCase() === token.toLowerCase());
//   if (!tokenMetadata) {
//     log.warn(`Ignoring deposit for unsupported token: ${token}`);
//     return null;
//   }

//   return tokenMetadata;
// }

// export { flattenNestedMap, checkToken };
export { flattenNestedMap };
