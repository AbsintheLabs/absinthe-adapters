// pseudo-code
// state:
// activeBalancesMap = address: {balance, start_ts} 
// balanceHistoryWindows = {address, balance, ts_start, ts_end}
// 
// logic:
// on each transfer, log the duration the asset (LP token) was held for
// on each transfer, update the new activeBalancesMap
-- this is done

// on each exhausted time period, flush all balanceHistoryWindows records between the last update and the new update
// on each exhausted time period, update the activeBalancesMap with the new timestamp

// at the end of each block, iterate over all activeBalancesMap. If the lastupdated + interval length < current block timestamp, then its time to update it 
// (by forcing a flush the floored timestamp - ex: nearest hour)

// pricing: 
// each lp token = (reserve0 / decimals0 * price0 + reserve1 / decimals1 * price1) / (total_supply LP token supply)
// when does pricing happen?

// initialize:
// fetch token0 and token1 addresses
// call decimals() for token0 and token1 and save to db
// once defined, don't need to do this again

// requirement: pricing should be computed for the beginning of the window

// case 1: on transfer
// see if price exists for the assets for the min pricing granularity (default 1 hour or 3600 seconds determined by date_trunc cutoff)
// if not, fetch price for that hour. else use the cached price.
// make RPC call to getReserves() and totalSupply()
// create a new balanceHistoryWindow for the LP token using older activeBalancesMap entry (beginning of the window)
// calculate price of each LP token and save it to activeBalancesMap

// case 2: on exhausted time period flush
// tbd...

### In English

