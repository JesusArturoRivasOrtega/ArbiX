import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { ModuleRef } from "@nestjs/core";
import type { BotConfig, LatencyMetrics } from "@arbix/shared";
import type { Server, Socket } from "socket.io";
import { AppConfigService } from "../config/app.config.js";
import { PersistenceService } from "../database/persistence.service.js";
import { MarketDataService } from "../market-data/market-data.service.js";
import { CircuitBreaker } from "../risk/circuit-breaker.js";
import { WalletService } from "../simulator/wallet.service.js";
import { RealtimeEventsService } from "./realtime-events.service.js";

@WebSocketGateway({
  cors: {
    origin: getAllowedFrontendOrigins(),
    credentials: true
  }
})
export class TradingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly config: AppConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly persistence: PersistenceService
  ) {}

  afterInit(server: Server) {
    this.realtime.bind(server);
  }

  handleConnection(client: Socket) {
    this.realtime.clientConnected();
    this.clearRestoredFrontendBreaker();
    client.emit("bot.status.updated", {
      status: "RUNNING",
      mode: this.config.marketMode,
      message: "ArbiX realtime channel connected.",
      connectedAt: new Date().toISOString()
    });
  }

  handleDisconnect() {
    this.realtime.clientDisconnected();
  }

  @SubscribeMessage("config.update")
  async updateConfig(@MessageBody() payload: Partial<BotConfig>, @ConnectedSocket() client: Socket) {
    const before = this.config.getConfig();
    const config = this.config.updateConfig(payload as never);
    if (requiresAdapterRestart(before, config)) {
      await this.marketData().reset();
    }
    client.emit("config.updated", config);
    this.realtime.publish("bot.status.updated", {
      status: "RUNNING",
      mode: config.marketMode,
      message: requiresAdapterRestart(before, config)
        ? "Configuration updated. Market adapters reconnected."
        : "Configuration updated."
    });
    return config;
  }

  @SubscribeMessage("bot.start")
  async startBot() {
    return this.marketData().start();
  }

  @SubscribeMessage("bot.stop")
  async stopBot() {
    return this.marketData().stop();
  }

  @SubscribeMessage("bot.pause")
  async pauseBot() {
    return this.marketData().pause();
  }

  @SubscribeMessage("bot.reset")
  async resetBot() {
    return this.marketData().reset();
  }

  @SubscribeMessage("wallet.reset")
  resetWallet() {
    this.wallets().reset();
    return { accepted: true, balances: this.wallets().getBalances(), ledger: this.wallets().getLedger() };
  }

  @SubscribeMessage("replay.start")
  async startReplay() {
    return this.marketData().runScenario("profitable-arbitrage");
  }

  @SubscribeMessage("replay.scenario")
  async startReplayScenario(@MessageBody() payload: { scenarioName?: string; scenario?: string } | string) {
    const scenarioName = typeof payload === "string" ? payload : payload?.scenarioName ?? payload?.scenario ?? "profitable-arbitrage";
    return this.marketData().runScenario(scenarioName);
  }

  @SubscribeMessage("latency.ack")
  acknowledgeLatency(@MessageBody() payload: { exchange?: string; symbol?: string; latency?: LatencyMetrics }) {
    if (payload.exchange && payload.symbol && payload.latency) {
      this.persistence.saveLatencyMetric(payload.exchange, payload.symbol, payload.latency);
    }
    return { accepted: true };
  }

  private marketData() {
    return this.moduleRef.get(MarketDataService, { strict: false });
  }

  private wallets() {
    return this.moduleRef.get(WalletService, { strict: false });
  }

  private clearRestoredFrontendBreaker() {
    try {
      const breaker = this.moduleRef.get(CircuitBreaker, { strict: false });
      if (breaker.isActive() && breaker.getReason() === "Frontend realtime connection lost.") {
        breaker.clear("Frontend realtime connection restored.");
      }
    } catch {
      // The gateway can initialize before risk providers are available in tests.
    }
  }
}

function requiresAdapterRestart(before: BotConfig, after: BotConfig) {
  if (before.marketMode !== after.marketMode) return true;
  return before.enabledExchanges.slice().sort().join("|") !== after.enabledExchanges.slice().sort().join("|");
}

function getAllowedFrontendOrigins() {
  const localOrigins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ];
  return (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(localOrigins)
    .filter((origin, index, all) => all.indexOf(origin) === index);
}
