import type { BotConfig } from "@arbix/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 12_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = init?.signal ? undefined : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : undefined;

  try {
    const requestInit: RequestInit = {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    };
    if (init?.signal) {
      requestInit.signal = init.signal;
    } else if (controller) {
      requestInit.signal = controller.signal;
    }

    const response = await fetch(`${API_URL}${path}`, requestInit);
    const text = await response.text();
    if (!response.ok) {
      const detail = text ? `: ${text.slice(0, 180)}` : "";
      throw new Error(`API ${path} failed with ${response.status}${detail}`);
    }
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`API ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

export const api = {
  health: () => request("/health"),
  exchangeStatus: () => request("/exchanges/status"),
  marketSnapshots: () => request("/market/snapshots"),
  opportunities: () => request("/opportunities"),
  trades: () => request("/trades"),
  lastTrade: () => request("/simulator/last-trade"),
  wallets: () => request("/wallets"),
  analytics: () => request("/analytics/summary"),
  risk: () => request("/risk/status"),
  riskEvents: () => request("/risk/events"),
  clearCircuitBreaker: () => request("/risk/circuit-breaker/clear", { method: "POST" }),
  config: () => request<BotConfig>("/config"),
  updateConfig: (payload: Partial<BotConfig>) => request<BotConfig>("/config", { method: "PATCH", body: JSON.stringify(payload) }),
  replayScenario: (scenario: string) => request(`/replay/scenario/${scenario}`, { method: "POST" }),
  replayStart: () => request("/replay/start", { method: "POST" }),
  validateScenarios: () => request("/replay/validate-scenarios", { method: "POST" }),
  botStart: () => request("/bot/start", { method: "POST" }),
  botStop: () => request("/bot/stop", { method: "POST" }),
  botPause: () => request("/bot/pause", { method: "POST" }),
  botReset: () => request("/bot/reset", { method: "POST" }),
  resetWallets: () => request("/wallets/reset", { method: "POST" }),
  orderbook: (exchange: string, symbol: string) => {
    const [base, quote] = symbol.split("/");
    return request(`/market/orderbook/${exchange}/${base}/${quote}`);
  },
  orderbooks: () => request("/market/orderbooks"),
  triangular: () => request("/strategy-lab/triangular"),
  simulateTriangular: () => request("/strategy-lab/triangular/simulate", { method: "POST" }),
  lastTriangularSimulation: () => request("/strategy-lab/triangular/last-simulation")
};
