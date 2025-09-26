import Big from 'big.js';

export async function handleLpTransfer(ctx, inst: any, ev) {
  const pool = inst.params.poolAddress.toLowerCase();
  const amount = new Big(ev.value.toString());

  // LP transfers: subtract from sender, add to receiver
  await emit.balanceDelta({
    user: ev.from,
    asset: pool,
    amount: amount.neg(),
    activity: 'hold',
  });

  await emit.balanceDelta({
    user: ev.to,
    asset: pool,
    amount: amount,
    activity: 'hold',
  });
}
