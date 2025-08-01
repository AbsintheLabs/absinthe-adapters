import { ActiveBalance } from '@absinthe/common';
import { TOKEN_METADATA } from './consts';
import { TokenMetadata } from './types';

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

function checkToken(token: string): TokenMetadata | null {
  let tokenMetadata = TOKEN_METADATA.find((t) => t.address.toLowerCase() === token.toLowerCase());
  if (!tokenMetadata) {
    console.warn(`Ignoring deposit for unsupported token: ${token}`);
    return null;
  }

  return tokenMetadata;
}

export { checkToken, flattenNestedMap };
