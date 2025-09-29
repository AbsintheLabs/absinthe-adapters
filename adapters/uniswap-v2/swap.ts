// stub handler for now
export function handleSwap({ redis, }): Promise<void> {
    // necessary items:
    /*
    - emit - not done yet, needs to have the right type based on trackable type
    - redis - not done yet, but easy to add
    - rpc - not done yet, for now, will keep the same one that we have
    - transactionHash - comes from unified evm event type
    - transaction.from - comes from unified evm event type
    - log.address - comes from unified evm event type
    - log.logIndex - comes from unified evm event type
    - decoded log data (of the swap) - should stay encoded for now, decoding happens in the handler
    - trackable instances - comes from the handler context
    */

    //---
    // Try to get token0 and token1 addresses from redis cache
    const token0Key = `univ2:${params.poolAddress}:token0`;
    const token1Key = `univ2:${params.poolAddress}:token1`;
    let tk0Addr = await redis.get(token0Key);
    let tk1Addr = await redis.get(token1Key);

    if (!tk0Addr || !tk1Addr) {
        const poolContract = new univ2Abi.Contract(rpc, params.poolAddress);
        tk0Addr = (await poolContract.token0()).toLowerCase();
        tk1Addr = (await poolContract.token1()).toLowerCase();
        await redis.set(token0Key, tk0Addr);
        await redis.set(token1Key, tk1Addr);
    }

    const { amount0In, amount1In, amount0Out, amount1Out } = univ2Abi.events.Swap.decode(log);
    const isToken0ToToken1 = amount0In > 0n ? true : false;

    // Get the amounts
    const fromAmount = isToken0ToToken1 ? amount0In : amount1In;
    const toAmount = isToken0ToToken1 ? amount1Out : amount0Out;

    // Get token addresses (you'll need these from your pool/pair contract)
    const fromTokenAddress = isToken0ToToken1 ? tk0Addr : tk1Addr;
    const toTokenAddress = isToken0ToToken1 ? tk1Addr : tk0Addr;

    // step 1: get the user as the tx.from
    const user = log.transaction?.from;
    if (!user) {
      console.error('Debug: transaction.from is not found in the log.', {
        log,
        transaction: log.transaction,
      });
      throw new Error('transaction.from is not found in the log.');
    }

    // step 2: format the swap metadata
    const swapMeta = {
      fromTkAddress: fromTokenAddress,
      toTkAddress: toTokenAddress,
      fromTkAmount: fromAmount.toString(),
      toTkAmount: toAmount.toString(),
    };

    // step 3: emit swap action for each token
    // from side
    await emit.swap({
      // make sure to dedupe the duplicate swaps, we only need to save one!
      key: md5Hash(`${log.transactionHash}${log.logIndex}`),
      priceable: true,
      activity: 'swap',
      user: user,
      amount: {
        asset: fromTokenAddress,
        amount: new Big(fromAmount.toString()),
      },
      meta: swapMeta,
    });

    await emit.swap({
      // make sure to dedupe the duplicate swaps, we only need to save one!
      key: md5Hash(`${log.transactionHash}${log.logIndex}`),
      priceable: true,
      activity: 'swap',
      user: user,
      amount: {
        asset: toTokenAddress,
        amount: new Big(toAmount.toString()),
      },
      meta: swapMeta,
    });
  }
}
