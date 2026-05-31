import type {
  AdapterMode,
  BestQuote,
  ExchangeConnectionStatus,
  ExchangeName,
  NormalizedOrderBook,
  TradingSymbol
} from "@arbix/shared";

export interface ExchangeAdapter {
  name: ExchangeName;
  mode: AdapterMode;
  connect(symbols: TradingSymbol[]): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onQuote(callback: (quote: BestQuote) => void): void;
  onOrderBook(callback: (orderBook: NormalizedOrderBook) => void): void;
  getStatus(): ExchangeConnectionStatus;
  getAdapterId(): string;
  getGenerationId(): number;
  setGenerationId(generationId: number): void;
}
