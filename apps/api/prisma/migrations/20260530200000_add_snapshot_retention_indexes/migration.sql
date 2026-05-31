CREATE INDEX IF NOT EXISTS "MarketSnapshot_exchange_symbol_createdAt_idx"
  ON "MarketSnapshot"("exchange", "symbol", "createdAt");

CREATE INDEX IF NOT EXISTS "MarketSnapshot_createdAt_idx"
  ON "MarketSnapshot"("createdAt");

CREATE INDEX IF NOT EXISTS "OrderBookSnapshot_exchange_symbol_createdAt_idx"
  ON "OrderBookSnapshot"("exchange", "symbol", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderBookSnapshot_createdAt_idx"
  ON "OrderBookSnapshot"("createdAt");

CREATE INDEX IF NOT EXISTS "Opportunity_symbol_createdAt_idx"
  ON "Opportunity"("symbol", "createdAt");

CREATE INDEX IF NOT EXISTS "Opportunity_status_createdAt_idx"
  ON "Opportunity"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "LatencyMetric_exchange_symbol_createdAt_idx"
  ON "LatencyMetric"("exchange", "symbol", "createdAt");

CREATE INDEX IF NOT EXISTS "LatencyMetric_createdAt_idx"
  ON "LatencyMetric"("createdAt");
