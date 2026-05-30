import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const localOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ];
  const allowedOrigins = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .concat(localOrigins)
    .filter((origin, index, all) => all.indexOf(origin) === index);

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ArbiX - Bitcoin Arbitrage API")
    .setDescription(
      "Real-time multi-exchange arbitrage detection and simulation engine. " +
      "Connects to Binance, Kraken, and OKX via WebSocket, detects cross-exchange price divergences, " +
      "evaluates profitability net of fees/slippage, and simulates execution with virtual wallets."
    )
    .setVersion("1.0.0")
    .addTag("opportunities", "Detected arbitrage opportunities with cost breakdown and confidence scores")
    .addTag("market", "Live order book and best-quote price feeds per exchange")
    .addTag("simulator", "Simulated trade execution, timelines and wallet updates")
    .addTag("wallets", "Virtual wallet balances and ledger entries")
    .addTag("analytics", "Performance metrics, P&L charts and rejection analysis")
    .addTag("risk", "Risk engine status, circuit breaker, and risk events log")
    .addTag("config", "Bot configuration - fees, risk thresholds, enabled exchanges")
    .addTag("strategy-lab", "Advanced strategies: triangular arbitrage simulation")
    .addTag("health", "System health: adapters, database, order book freshness")
    .addTag("bot", "Bot lifecycle - start, stop, pause, reset")
    .addTag("replay", "Replay scenarios for demo and backtesting")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true }
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`ArbiX API listening on http://localhost:${port}`);
  console.log(`API docs available at http://localhost:${port}/api/docs`);
}

void bootstrap();
