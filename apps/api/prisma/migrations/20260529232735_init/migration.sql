-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "bidPrice" DOUBLE PRECISION NOT NULL,
    "bidQty" DOUBLE PRECISION NOT NULL,
    "askPrice" DOUBLE PRECISION NOT NULL,
    "askQty" DOUBLE PRECISION NOT NULL,
    "exchangeTimestamp" BIGINT NOT NULL,
    "backendReceivedAt" BIGINT NOT NULL,
    "normalizedAt" BIGINT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderBookSnapshot" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "bids" JSONB NOT NULL,
    "asks" JSONB NOT NULL,
    "exchangeTimestamp" BIGINT NOT NULL,
    "backendReceivedAt" BIGINT NOT NULL,
    "normalizedAt" BIGINT NOT NULL,
    "sequence" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderBookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "buyExchange" TEXT NOT NULL,
    "sellExchange" TEXT NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "executionBuyPrice" DOUBLE PRECISION NOT NULL,
    "executionSellPrice" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "grossSpread" DOUBLE PRECISION NOT NULL,
    "grossSpreadPercent" DOUBLE PRECISION NOT NULL,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "netProfitPercent" DOUBLE PRECISION NOT NULL,
    "buyFee" DOUBLE PRECISION NOT NULL,
    "sellFee" DOUBLE PRECISION NOT NULL,
    "withdrawalFee" DOUBLE PRECISION NOT NULL,
    "slippageCost" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "recommendation" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedTrade" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "buyExchange" TEXT NOT NULL,
    "sellExchange" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "buyCost" DOUBLE PRECISION NOT NULL,
    "sellRevenue" DOUBLE PRECISION NOT NULL,
    "totalFees" DOUBLE PRECISION NOT NULL,
    "slippageCost" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedger" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "tradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfig" (
    "id" TEXT NOT NULL,
    "marketMode" TEXT NOT NULL DEFAULT 'DEMO',
    "enabledExchanges" JSONB,
    "fees" JSONB,
    "minNetProfitPercent" DOUBLE PRECISION NOT NULL,
    "maxTradeSize" DOUBLE PRECISION NOT NULL,
    "maxLatencyMs" INTEGER NOT NULL,
    "maxOrderBookAgeMs" INTEGER NOT NULL,
    "maxSlippagePercent" DOUBLE PRECISION NOT NULL,
    "allowPartialFills" BOOLEAN NOT NULL,
    "autoSimulationEnabled" BOOLEAN NOT NULL,
    "circuitBreakerEnabled" BOOLEAN NOT NULL,
    "maxRejectedOpportunitiesPerMinute" INTEGER NOT NULL,
    "maxNegativePnLBeforeStop" DOUBLE PRECISION NOT NULL,
    "minLiquidityScore" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LatencyMetric" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeToBackendMs" INTEGER NOT NULL,
    "normalizationMs" INTEGER NOT NULL,
    "detectionLatencyMs" INTEGER NOT NULL,
    "backendToFrontendMs" INTEGER,
    "endToEndLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LatencyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayEvent" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_name_key" ON "Exchange"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_exchange_asset_key" ON "WalletBalance"("exchange", "asset");
