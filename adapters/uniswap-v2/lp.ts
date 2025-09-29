import Big from 'big.js';

// todo: add the fields that i'll actually need!
export async function handleLpTransfer() {
  // need:
  // from, to, value, asset address -> these are all decoded log data
  // emit functions (balanceDelta and related functions since we're a position trackable)

  // LP transfers: subtract from sender, add to receiver
  await emit.balanceDelta({
    user: from,
    asset: poolAddress,
    amount: amount.neg(),
    activity: 'hold',
  });

  await emit.balanceDelta({
    user: to,
    asset: poolAddress,
    amount: amount,
    activity: 'hold',
  });
}
