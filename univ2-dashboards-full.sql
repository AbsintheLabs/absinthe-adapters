-- ========================================================================
-- UNISWAP V2 COMPREHENSIVE DASHBOARD ANALYTICS
-- Complete SQL templates for all 4 dashboards
-- ========================================================================

-- ========================================================================
-- GLOBAL FILTERS (Apply to ALL dashboards)
-- ========================================================================

/*
Filter Parameters:
1. {{pool_address}} - Pool contract address (from ctx_json.address or end_ctx_json.address)
   Example: 0xc555d55279023e732ccd32d812114caf5838fd46
   
2. {{api_key_hash}} - Runner API key hash for filtering by indexer run
   Field: runner_api_key_hash
   
3. Optional filters:
   - Time range: ts_ms for actions, window_utc_end_ts_ms for positions
   - chain_id
   - trackable_instance_id

Data Model:
- actions table: Swap events (accumulating)
  - quantity: USD value of swap
  - ctx_json: {"address": "pool_address", "transactionTo": "router", ...}
  - metadata_json: {"fromTkAddress": "0x...", "fromTkAmount": "...", "toTkAddress": "0x...", "toTkAmount": "..."}
  
- positions table: LP holdings
  - quantity: USD value of LP position
  - end_value: Raw LP token balance
  - end_ctx_json: {"address": "pool_address", ...}
*/

-- ========================================================================
-- DASHBOARD 1: CMO OVERVIEW
-- One-screen executive view: growth, demand, retention, power users
-- ========================================================================

-- KPI 1: Unique Traders (DAU)
SELECT COUNT(DISTINCT user) as traders
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 86400000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]];

-- KPI 2: WAU (Weekly Active Users)
SELECT COUNT(DISTINCT user) as wau
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 604800000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]];

-- KPI 3: MAU (Monthly Active Users)
SELECT COUNT(DISTINCT user) as mau
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 2592000000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]];

-- KPI 4: Total Swaps (24h)
SELECT COUNT(*) as swaps
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 86400000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]];

-- KPI 5: Total Swap Volume (USD) - 24h
SELECT SUM(quantity) as volume_usd
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 86400000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]];

-- KPI 6: Current LP Holders
WITH latest_positions AS (
  SELECT user, end_value, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as lp_holders
FROM latest_positions
WHERE rn = 1 AND TRY_CAST(end_value AS DOUBLE) > 0;

-- KPI 7: Total LP Value (USD)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT SUM(quantity) as total_lp_usd
FROM latest_positions
WHERE rn = 1;

-- KPI 8: LP Whales (Top 10 Concentration %)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
),
top10 AS (
  SELECT SUM(quantity) as top10_value
  FROM (
    SELECT quantity FROM latest_positions WHERE rn = 1 ORDER BY quantity DESC LIMIT 10
  )
),
total AS (
  SELECT SUM(quantity) as total_value FROM latest_positions WHERE rn = 1
)
SELECT (top10_value / total_value * 100) as concentration_pct
FROM top10, total;

-- TIME SERIES 1: Swaps Over Time
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000)) as date,
  COUNT(*) as swaps
FROM actions
WHERE protocol_name = 'uniswap-v2'
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY date
ORDER BY date;

-- TIME SERIES 2: Volume Over Time (USD)
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000)) as date,
  SUM(quantity) as volume_usd
FROM actions
WHERE protocol_name = 'uniswap-v2'
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY date
ORDER BY date;

-- TIME SERIES 3: LP Holders Over Time
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_holders AS (
  SELECT 
    ds.date,
    ds.user,
    p.end_value
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'uniswap-v2'
)
SELECT 
  date,
  COUNT(DISTINCT user) as lp_holders
FROM daily_holders
WHERE TRY_CAST(end_value AS DOUBLE) > 0
GROUP BY date
ORDER BY date;

-- TIME SERIES 4: New Traders Over Time
WITH first_swaps AS (
  SELECT 
    user,
    MIN(ts_ms) as first_swap_ts
  FROM actions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
)
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(first_swap_ts / 1000)) as date,
  COUNT(*) as new_traders
FROM first_swaps
GROUP BY date
ORDER BY date;

-- LEADERBOARD 1: Top Traders (7d)
SELECT 
  user,
  COUNT(*) as swap_count,
  SUM(quantity) as volume_usd,
  MAX(TO_TIMESTAMP(ts_ms / 1000)) as last_swap
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 604800000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY user
ORDER BY swap_count DESC
LIMIT 20;

-- ========================================================================
-- DASHBOARD 2: TRADING & DEMAND
-- Token demand signals: buy/sell pressure, trader behavior, routes
-- ========================================================================

-- TIME SERIES 1: Unique Traders Over Time
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000)) as date,
  COUNT(DISTINCT user) as traders
FROM actions
WHERE protocol_name = 'uniswap-v2'
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY date
ORDER BY date;

-- TIME SERIES 2: Avg Swaps per User (Daily)
WITH daily_stats AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000)) as date,
    COUNT(*) as total_swaps,
    COUNT(DISTINCT user) as unique_traders
  FROM actions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date
)
SELECT 
  date,
  (total_swaps::DOUBLE / NULLIF(unique_traders, 0)) as avg_swaps_per_user
FROM daily_stats
ORDER BY date;

-- LEADERBOARD 1: Top Routers / Aggregators (7d)
SELECT 
  json_extract_string(ctx_json, '$.transactionTo') as router,
  COUNT(*) as swap_count,
  SUM(quantity) as volume_usd
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 604800000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY router
ORDER BY swap_count DESC
LIMIT 10;

-- KPI: Repeat Trader Rate (% with ≥2 active days in last 7d)
WITH user_activity AS (
  SELECT 
    user,
    COUNT(DISTINCT DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000))) as active_days
  FROM actions
  WHERE protocol_name = 'uniswap-v2'
    AND ts_ms > (EPOCH_MS(NOW()) - 604800000)
    [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
)
SELECT 
  (COUNT(CASE WHEN active_days >= 2 THEN 1 END)::DOUBLE / COUNT(*) * 100) as repeat_rate_pct
FROM user_activity;

-- ========================================================================
-- DASHBOARD 3: HOLDERS & RETENTION
-- Real adoption: holder growth, churn, accumulation behavior
-- ========================================================================

-- KPI 1: New LP Holders (24h)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as new_lp_holders
FROM transitions
WHERE before_bal = 0 AND after_bal > 0;

-- KPI 2: Churned LP Holders (24h)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as churned_lp
FROM transitions
WHERE before_bal > 0 AND after_bal = 0;

-- KPI 3: Median LP Balance (USD)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT MEDIAN(quantity) as median_lp_balance
FROM latest_positions
WHERE rn = 1;

-- TIME SERIES 1: LP Holders Over Time
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_holders AS (
  SELECT 
    ds.date,
    ds.user,
    p.end_value
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'uniswap-v2'
)
SELECT 
  date,
  COUNT(DISTINCT user) as lp_holders
FROM daily_holders
WHERE TRY_CAST(end_value AS DOUBLE) > 0
GROUP BY date
ORDER BY date;

-- TIME SERIES 2: LP Value Over Time (USD)
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_values AS (
  SELECT 
    ds.date,
    SUM(p.quantity) as total_value
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'uniswap-v2'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
  GROUP BY ds.date
)
SELECT date, total_value
FROM daily_values
ORDER BY date;

-- TIME SERIES 3: New LP Holders Over Time
WITH daily_new_lp AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  date,
  SUM(CASE WHEN before_bal = 0 AND after_bal > 0 THEN 1 ELSE 0 END) as new_lp_holders
FROM daily_new_lp
GROUP BY date
ORDER BY date;

-- DISTRIBUTION: LP Distribution (Buckets)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
),
bucketed AS (
  SELECT 
    CASE 
      WHEN quantity < 100 THEN '$0-$100'
      WHEN quantity < 1000 THEN '$100-$1k'
      WHEN quantity < 10000 THEN '$1k-$10k'
      WHEN quantity < 100000 THEN '$10k-$100k'
      ELSE '$100k+'
    END as bucket,
    user
  FROM latest_positions
  WHERE rn = 1
)
SELECT bucket, COUNT(*) as lp_holders
FROM bucketed
GROUP BY bucket
ORDER BY MIN(CASE bucket 
  WHEN '$0-$100' THEN 1
  WHEN '$100-$1k' THEN 2
  WHEN '$1k-$10k' THEN 3
  WHEN '$10k-$100k' THEN 4
  ELSE 5 END);

-- LEADERBOARD: Top LP Providers
WITH latest_positions AS (
  SELECT user, quantity, window_utc_end_ts_ms, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'uniswap-v2'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND json_extract_string(end_ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  user,
  quantity as lp_value_usd,
  TO_TIMESTAMP(window_utc_end_ts_ms / 1000) as last_updated
FROM latest_positions
WHERE rn = 1
ORDER BY quantity DESC
LIMIT 20;

-- ========================================================================
-- DASHBOARD 4: POWER USERS
-- Power user identification: frequency, consistency, economic weight
-- ========================================================================

-- LEADERBOARD 1: Power User Leaderboard (Composite Score)
WITH trader_stats AS (
  SELECT 
    user,
    COUNT(*) as swap_count,
    COUNT(DISTINCT DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000))) as active_days,
    SUM(quantity) as total_volume_usd,
    MAX(ts_ms) as last_seen_ms,
    MIN(ts_ms) as first_seen_ms
  FROM actions
  WHERE protocol_name = 'uniswap-v2'
    AND ts_ms > (EPOCH_MS(NOW()) - 2592000000)
    [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
),
scored AS (
  SELECT 
    user,
    swap_count,
    active_days,
    total_volume_usd,
    (EPOCH_MS(NOW()) - last_seen_ms) / 86400000.0 as days_since_last,
    (swap_count * active_days * LOG(1 + total_volume_usd)) as power_score
  FROM trader_stats
)
SELECT 
  user,
  ROUND(power_score, 2) as score,
  swap_count,
  active_days,
  total_volume_usd,
  ROUND(days_since_last, 1) as days_inactive
FROM scored
ORDER BY power_score DESC
LIMIT 20;

-- Power Score Formula:
-- score = swap_count × active_days × LOG(1 + total_volume_usd)
-- This balances:
-- - Frequency (swap_count)
-- - Consistency (active_days)
-- - Economic weight (LOG scaled volume to prevent whale dominance)
-- - Recency (days_inactive for sorting/filtering)

-- LEADERBOARD 2: Most Consistent Traders (30d)
WITH user_consistency AS (
  SELECT 
    user,
    COUNT(DISTINCT DATE_TRUNC('day', TO_TIMESTAMP(ts_ms / 1000))) as active_days,
    COUNT(*) as total_swaps,
    SUM(quantity) as volume_usd
  FROM actions
  WHERE protocol_name = 'uniswap-v2'
    AND ts_ms > (EPOCH_MS(NOW()) - 2592000000)
    [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
)
SELECT 
  user,
  active_days,
  total_swaps,
  volume_usd
FROM user_consistency
ORDER BY active_days DESC, total_swaps DESC
LIMIT 20;

-- LEADERBOARD 3: Top Traders by Volume (7d)
SELECT 
  user,
  COUNT(*) as swap_count,
  SUM(quantity) as volume_usd,
  MAX(TO_TIMESTAMP(ts_ms / 1000)) as last_swap
FROM actions
WHERE protocol_name = 'uniswap-v2'
  AND ts_ms > (EPOCH_MS(NOW()) - 604800000)
  [[AND json_extract_string(ctx_json, '$.address') = {{pool_address}}]]
  [[AND runner_api_key_hash = {{api_key_hash}}]]
GROUP BY user
ORDER BY volume_usd DESC
LIMIT 20;

-- ========================================================================
-- SANITY CHECKS & VALIDATION
-- ========================================================================

/*
IMPORTANT NOTES:

1. JSON Field Extraction:
   - Pool address (actions): json_extract_string(ctx_json, '$.address')
   - Pool address (positions): json_extract_string(end_ctx_json, '$.address')
   - Router address: json_extract_string(ctx_json, '$.transactionTo')
   - Token addresses: json_extract_string(metadata_json, '$.fromTkAddress')
   
2. Quantity Field:
   - For actions: quantity = USD value of the swap (already calculated)
   - For positions: quantity = USD value of the LP position (already calculated)
   - DO NOT multiply quantity by anything - it's already the final USD value

3. LP Position Tracking:
   - end_value: Raw LP token balance (use for detecting > 0)
   - quantity: USD value of position
   - raw_before/raw_after: For detecting new entries (0 → >0) or exits (>0 → 0)

4. Swap Direction (Buy vs Sell):
   - Buy: json_extract_string(metadata_json, '$.toTkAddress') == target_token
   - Sell: json_extract_string(metadata_json, '$.fromTkAddress') == target_token
   - This requires specifying which token you're tracking

5. Performance:
   - Use ROW_NUMBER() window functions to get latest positions per user
   - Use CTEs for readability
   - Filter by protocol_name early
   - Add indexes on: (protocol_name, ts_ms), (protocol_name, window_utc_end_ts_ms)

6. Common Patterns:
   - Latest position per user: ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC)
   - Active users: COUNT(DISTINCT user) with time filter
   - New users: MIN(ts_ms) grouped by user to find first activity
   - Churn detection: raw_before > 0 AND raw_after = 0

All filters are optional - leave blank to see all data across all pools/indexers.
*/


