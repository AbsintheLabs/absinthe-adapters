import { BlockHandlerContext } from './interfaces/interfaces';
import * as ERC20 from '../abi/ERC20';
import * as ERC20NameBytes from '../abi/ERC20NameBytes';
import * as ERC20SymbolBytes from '../abi/ERC20SymbolBytes';
import { Multicall } from './multicall';
import { MULTICALL_ADDRESS } from './constants';
import { StaticTokenDefinition } from './staticTokenDefinition';
import { removeNullBytes } from './tools';
import { Store } from '@subsquid/typeorm-store';

export async function fetchTokensSymbol(ctx: BlockHandlerContext<Store>, tokenAddresses: string[]) {
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
  const symbols = new Map<string, string>();

  const results = await multicall.tryAggregate(
    ERC20.functions.symbol,
    tokenAddresses.map((a) => [a, {}]),
  );

  results.forEach((res, i) => {
    const address = tokenAddresses[i];
    let sym: string | undefined;
    if (res.success) {
      sym = String(res.value);
    } else if (res.returnData) {
      sym = ERC20SymbolBytes.functions.symbol.decodeResult(res.returnData);
    }
    if (sym) {
      symbols.set(address, removeNullBytes(sym));
    } else {
      const value = StaticTokenDefinition.fromAddress(address)?.symbol;
      if (value == null) ctx.log.warn(`Missing symbol for token ${address}`);
      symbols.set(address, value || 'unknown');
    }
  });

  return symbols;
}

export async function fetchTokensName(ctx: BlockHandlerContext<Store>, tokenAddresses: string[]) {
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  const names = new Map<string, string>();

  const results = await multicall.tryAggregate(
    ERC20.functions.name,
    tokenAddresses.map((a) => [a, {}]),
  );

  results.forEach((res, i) => {
    const address = tokenAddresses[i];
    let name: string | undefined;
    if (res.success) {
      name = String(res.value);
    } else if (res.returnData) {
      name = ERC20NameBytes.functions.name.decodeResult(res.returnData);
    }
    if (name) {
      names.set(address, removeNullBytes(name));
    } else {
      const value = StaticTokenDefinition.fromAddress(address)?.name;
      if (value == null) ctx.log.warn(`Missing name for token ${address}`);
      names.set(address, value || 'unknown');
    }
  });

  return names;
}

export async function fetchTokensTotalSupply(
  ctx: BlockHandlerContext<Store>,
  tokenAddresses: string[],
) {
  //tokenAddresses = ["0x7F5c764cBc14f9669B88837ca1490cCa17c31607"];
  let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  let results = await multicall.tryAggregate(
    ERC20.functions.totalSupply,
    tokenAddresses.map((a) => [a, {}]),
  );

  return new Map(
    results.map((res, i) => {
      let address = tokenAddresses[i];
      let supply = res.success ? BigInt(res.value) : 0n;
      return [address, supply];
    }),
  );
}

export async function fetchTokensDecimals(
  ctx: BlockHandlerContext<Store>,
  tokenAddresses: string[],
) {
  let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

  let results = await multicall.tryAggregate(
    ERC20.functions.decimals,
    tokenAddresses.map((a) => [a, {}]),
  );

  return new Map(
    results.map((res: any, i: any) => {
      i = Number(i);
      let address = tokenAddresses[i];
      let decimals = res.success ? res.value : 0;
      return [address, decimals];
    }),
  );
}
