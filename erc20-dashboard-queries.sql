-- ========================================
-- ERC20 EXECUTIVE OVERVIEW DASHBOARD
-- All queries for comprehensive token analytics
-- ========================================

-- FILTERS:
-- {{contract_address}} - Optional contract address filter (e.g., 0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee)
-- {{api_key_hash}} - Optional API key hash filter

-- ========================================
-- SECTION 1: KEY PERFORMANCE INDICATORS
-- ========================================

-- 1. Current Holders
WITH latest_positions AS (
  SELECT user, end_value, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as holders
FROM latest_positions
WHERE rn = 1 AND TRY_CAST(end_value AS DOUBLE) > 0;

-- 2. New Holders (24h)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal,
    window_utc_end_ts_ms
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as new_holders
FROM transitions
WHERE before_bal = 0 AND after_bal > 0;

-- 3. Churned Holders (24h)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal,
    window_utc_end_ts_ms
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as churned
FROM transitions
WHERE before_bal > 0 AND after_bal = 0;

-- 4. Total Held Value (USD)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT SUM(quantity) as total_usd
FROM latest_positions
WHERE rn = 1;

-- 5. Whale Count (>$100k)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(*) as whales
FROM latest_positions
WHERE rn = 1 AND quantity > 100000;

-- 6. Top 10 Concentration %
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
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

-- 7. Median Balance (USD)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT MEDIAN(quantity) as median_balance
FROM latest_positions
WHERE rn = 1;

-- 8. Net Flow 24h (USD)
WITH recent_flows AS (
  SELECT 
    TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / (TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals)) as flow_usd
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT SUM(flow_usd) as net_flow
FROM recent_flows;

-- 9. New Holders (7d)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 604800000)
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as new_holders_7d
FROM transitions
WHERE before_bal = 0 AND after_bal > 0;

-- 10. Churned Holders (7d)
WITH transitions AS (
  SELECT user, 
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 604800000)
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT COUNT(DISTINCT user) as churned_7d
FROM transitions
WHERE before_bal > 0 AND after_bal = 0;

-- 11. P90 Balance (USD)
WITH latest_positions AS (
  SELECT quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY quantity) as p90_balance
FROM latest_positions
WHERE rn = 1;

-- 12. Gross Flow 7d (USD)
WITH recent_flows AS (
  SELECT 
    ABS(TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / NULLIF(TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals), 0)) as abs_flow
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 604800000)
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT SUM(abs_flow) as gross_flow
FROM recent_flows;

-- ========================================
-- SECTION 2: TIME SERIES ANALYTICS
-- ========================================

-- 13. Holders Over Time
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_balances AS (
  SELECT 
    ds.date,
    ds.user,
    p.end_value
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'erc20-holdings'
)
SELECT 
  date,
  COUNT(DISTINCT user) as holders
FROM daily_balances
WHERE TRY_CAST(end_value AS DOUBLE) > 0
GROUP BY date
ORDER BY date;

-- 14. New vs Churned (Daily)
WITH daily_transitions AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  date,
  SUM(CASE WHEN before_bal = 0 AND after_bal > 0 THEN 1 ELSE 0 END) as new_holders,
  SUM(CASE WHEN before_bal > 0 AND after_bal = 0 THEN 1 ELSE 0 END) as churned_holders
FROM daily_transitions
GROUP BY date
ORDER BY date;

-- 15. Total Value Over Time
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
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
    AND p.protocol_name = 'erc20-holdings'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
  GROUP BY ds.date
)
SELECT date, total_value
FROM daily_values
ORDER BY date;

-- 16. Net Flows Over Time (Inflow/Outflow)
WITH daily_flows AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / NULLIF(TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals), 0) as flow_usd
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  date,
  SUM(CASE WHEN flow_usd > 0 THEN flow_usd ELSE 0 END) as inflow,
  SUM(CASE WHEN flow_usd < 0 THEN ABS(flow_usd) ELSE 0 END) as outflow
FROM daily_flows
GROUP BY date
ORDER BY date;

-- 17. Holder Segments Over Time (Retail/Mid/Whale)
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_values AS (
  SELECT 
    ds.date,
    ds.user,
    p.quantity,
    CASE 
      WHEN p.quantity < 10000 THEN 'Retail'
      WHEN p.quantity < 100000 THEN 'Mid'
      ELSE 'Whale'
    END as segment
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'erc20-holdings'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
)
SELECT 
  date,
  SUM(CASE WHEN segment = 'Retail' THEN 1 ELSE 0 END) as retail,
  SUM(CASE WHEN segment = 'Mid' THEN 1 ELSE 0 END) as mid,
  SUM(CASE WHEN segment = 'Whale' THEN 1 ELSE 0 END) as whale
FROM daily_values
GROUP BY date
ORDER BY date;

-- 18. New Holders Per Day
WITH first_holds AS (
  SELECT 
    user,
    MIN(window_utc_end_ts_ms) as first_hold_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(raw_after AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
)
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(first_hold_ts / 1000)) as date,
  COUNT(*) as new_holders
FROM first_holds
GROUP BY date
ORDER BY date;

-- 19. Concentration Trend (Top 10 Share)
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_values AS (
  SELECT 
    ds.date,
    ds.user,
    p.quantity,
    ROW_NUMBER() OVER (PARTITION BY ds.date ORDER BY p.quantity DESC) as rank
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'erc20-holdings'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
),
concentration AS (
  SELECT 
    date,
    SUM(CASE WHEN rank <= 10 THEN quantity ELSE 0 END) / SUM(quantity) * 100 as top10_pct
  FROM daily_values
  GROUP BY date
)
SELECT date, top10_pct
FROM concentration
ORDER BY date;

-- 20. Whale Value Over Time
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_values AS (
  SELECT 
    ds.date,
    p.quantity
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'erc20-holdings'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
    AND p.quantity >= 100000
)
SELECT 
  date,
  SUM(quantity) as whale_value
FROM daily_values
GROUP BY date
ORDER BY date;

-- 21. Churn Rate (Weekly %)
WITH weekly_transitions AS (
  SELECT 
    DATE_TRUNC('week', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as week,
    user,
    TRY_CAST(raw_before AS DOUBLE) as before_bal,
    TRY_CAST(raw_after AS DOUBLE) as after_bal
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
),
weekly_stats AS (
  SELECT 
    week,
    COUNT(DISTINCT CASE WHEN before_bal > 0 THEN user END) as active_start,
    COUNT(DISTINCT CASE WHEN before_bal > 0 AND after_bal = 0 THEN user END) as churned
  FROM weekly_transitions
  GROUP BY week
)
SELECT 
  week,
  (churned::DOUBLE / NULLIF(active_start, 0) * 100) as churn_rate_pct
FROM weekly_stats
WHERE active_start > 0
ORDER BY week;

-- 22. Value by Segment Over Time (Stacked)
WITH daily_snapshots AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    user,
    MAX(window_utc_end_ts_ms) as last_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY date, user
),
daily_segments AS (
  SELECT 
    ds.date,
    CASE 
      WHEN p.quantity < 10000 THEN 'Retail'
      WHEN p.quantity < 100000 THEN 'Mid'
      ELSE 'Whale'
    END as segment,
    p.quantity
  FROM daily_snapshots ds
  JOIN positions p ON p.user = ds.user 
    AND p.window_utc_end_ts_ms = ds.last_ts
    AND p.protocol_name = 'erc20-holdings'
  WHERE TRY_CAST(p.end_value AS DOUBLE) > 0
)
SELECT 
  date,
  SUM(CASE WHEN segment = 'Retail' THEN quantity ELSE 0 END) as retail_value,
  SUM(CASE WHEN segment = 'Mid' THEN quantity ELSE 0 END) as mid_value,
  SUM(CASE WHEN segment = 'Whale' THEN quantity ELSE 0 END) as whale_value
FROM daily_segments
GROUP BY date
ORDER BY date;

-- 23. Gross Flows Over Time
WITH daily_flows AS (
  SELECT 
    DATE_TRUNC('day', TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as date,
    ABS(TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / NULLIF(TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals), 0)) as abs_flow
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  date,
  SUM(abs_flow) as gross_flow
FROM daily_flows
GROUP BY date
ORDER BY date;

-- ========================================
-- SECTION 3: BALANCE DISTRIBUTION & SEGMENTATION
-- ========================================

-- 24. Balance Distribution (Buckets)
WITH latest_positions AS (
  SELECT user, quantity, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
),
bucketed AS (
  SELECT 
    CASE 
      WHEN quantity < 10 THEN '$0-$10'
      WHEN quantity < 100 THEN '$10-$100'
      WHEN quantity < 1000 THEN '$100-$1k'
      WHEN quantity < 10000 THEN '$1k-$10k'
      WHEN quantity < 100000 THEN '$10k-$100k'
      WHEN quantity < 1000000 THEN '$100k-$1M'
      ELSE '$1M+'
    END as bucket,
    user
  FROM latest_positions
  WHERE rn = 1
)
SELECT bucket, COUNT(*) as holders
FROM bucketed
GROUP BY bucket
ORDER BY MIN(CASE bucket 
  WHEN '$0-$10' THEN 1
  WHEN '$10-$100' THEN 2
  WHEN '$100-$1k' THEN 3
  WHEN '$1k-$10k' THEN 4
  WHEN '$10k-$100k' THEN 5
  WHEN '$100k-$1M' THEN 6
  ELSE 7 END);

-- 25. First Balance Distribution
WITH first_positions AS (
  SELECT 
    user,
    MIN(window_utc_end_ts_ms) as first_ts
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(raw_after AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
  GROUP BY user
),
first_balances AS (
  SELECT 
    fp.user,
    p.quantity,
    CASE 
      WHEN p.quantity < 10 THEN '$0-$10'
      WHEN p.quantity < 100 THEN '$10-$100'
      WHEN p.quantity < 1000 THEN '$100-$1k'
      WHEN p.quantity < 10000 THEN '$1k-$10k'
      WHEN p.quantity < 100000 THEN '$10k-$100k'
      ELSE '$100k+'
    END as bucket
  FROM first_positions fp
  JOIN positions p ON p.user = fp.user 
    AND p.window_utc_end_ts_ms = fp.first_ts
    AND p.protocol_name = 'erc20-holdings'
)
SELECT bucket, COUNT(*) as holders
FROM first_balances
GROUP BY bucket
ORDER BY MIN(CASE bucket 
  WHEN '$0-$10' THEN 1
  WHEN '$10-$100' THEN 2
  WHEN '$100-$1k' THEN 3
  WHEN '$1k-$10k' THEN 4
  WHEN '$10k-$100k' THEN 5
  ELSE 6 END);

-- 26. Holders by Chain
WITH latest_positions AS (
  SELECT user, chain_short_name, ROW_NUMBER() OVER (PARTITION BY user, chain_short_name ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  chain_short_name,
  COUNT(DISTINCT user) as holders
FROM latest_positions
WHERE rn = 1
GROUP BY chain_short_name
ORDER BY holders DESC;

-- ========================================
-- SECTION 4: POWER USERS & LEADERBOARDS
-- ========================================

-- 27. Top 20 Power Users
WITH latest_positions AS (
  SELECT user, quantity, window_utc_end_ts_ms, ROW_NUMBER() OVER (PARTITION BY user ORDER BY window_utc_end_ts_ms DESC) as rn
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND TRY_CAST(end_value AS DOUBLE) > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  user,
  quantity as value_usd,
  TO_TIMESTAMP(window_utc_end_ts_ms / 1000) as last_updated
FROM latest_positions
WHERE rn = 1
ORDER BY quantity DESC
LIMIT 20;

-- 28. Top Inflows Today
WITH recent_flows AS (
  SELECT 
    user,
    TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / NULLIF(TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals), 0) as flow_usd,
    window_utc_end_ts_ms
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  user,
  SUM(flow_usd) as total_inflow,
  MAX(TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as last_activity
FROM recent_flows
WHERE flow_usd > 0
GROUP BY user
ORDER BY total_inflow DESC
LIMIT 20;

-- 29. Top Outflows Today
WITH recent_flows AS (
  SELECT 
    user,
    TRY_CAST(raw_delta AS DOUBLE) / POWER(10, decimals) * quantity / NULLIF(TRY_CAST(end_value AS DOUBLE) / POWER(10, decimals), 0) as flow_usd,
    window_utc_end_ts_ms
  FROM positions
  WHERE protocol_name = 'erc20-holdings'
    AND window_utc_end_ts_ms > (EPOCH_MS(NOW()) - 86400000)
    AND TRY_CAST(end_value AS DOUBLE) > 0
    AND quantity > 0
    [[AND asset_key LIKE '%' || {{contract_address}} || '%']]
    [[AND runner_api_key_hash = {{api_key_hash}}]]
)
SELECT 
  user,
  ABS(SUM(flow_usd)) as total_outflow,
  MAX(TO_TIMESTAMP(window_utc_end_ts_ms / 1000)) as last_activity
FROM recent_flows
WHERE flow_usd < 0
GROUP BY user
ORDER BY total_outflow DESC
LIMIT 20;

-- ========================================
-- USAGE NOTES
-- ========================================

/*
Contract Address Filter:
- The asset_key field contains values like: "erc20:0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee"
- To filter by contract, use just the address: "0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee"
- The LIKE '%' || {{contract_address}} || '%' will match it within the asset_key

API Key Hash Filter:
- Use the exact runner_api_key_hash value to filter by specific indexer runs

Important Fields:
- quantity: Already contains USD value (token_amount × USD_price)
- end_value: Raw token balance (needs decimals conversion)
- raw_delta: Change in raw token balance
- raw_before/raw_after: Balance before/after window

All filters are optional - leave blank to see all data.
*/




