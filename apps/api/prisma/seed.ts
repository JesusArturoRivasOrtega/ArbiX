import { PrismaClient } from "@prisma/client";
import { defaultRiskConfig, initialWallets } from "@arbix/config";

const prisma = new PrismaClient();

async function main() {
  await prisma.botConfig.create({
    data: {
      ...defaultRiskConfig,
      marketMode: process.env.MARKET_MODE ?? "DEMO",
      enabledExchanges: ["BINANCE", "KRAKEN", "OKX"],
      fees: {
        BINANCE: { tradingFeeRate: 0.001, withdrawalFee: 0 },
        KRAKEN: { tradingFeeRate: 0.0026, withdrawalFee: 0 },
        OKX: { tradingFeeRate: 0.001, withdrawalFee: 0 },
        COINBASE: { tradingFeeRate: 0.002, withdrawalFee: 0 },
        MOCK: { tradingFeeRate: 0.001, withdrawalFee: 0 }
      }
    }
  });

  for (const [exchange, assets] of Object.entries(initialWallets)) {
    await prisma.exchange.upsert({
      where: { name: exchange },
      create: { name: exchange, status: "DISCONNECTED", mode: "DEMO" },
      update: { status: "DISCONNECTED", mode: "DEMO" }
    });

    for (const [asset, balance] of Object.entries(assets)) {
      await prisma.walletBalance.upsert({
        where: { exchange_asset: { exchange, asset } },
        create: { exchange, asset, balance },
        update: { balance }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
