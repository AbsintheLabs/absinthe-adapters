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

export function md5Hash(input: any, hashLength?: number): string {
  const data = typeof input === 'string' ? input : JSON.stringify(input);
  const hash = createHash('md5').update(data, 'utf8').digest('hex');
  return typeof hashLength === 'number' ? hash.slice(0, hashLength) : hash;
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
