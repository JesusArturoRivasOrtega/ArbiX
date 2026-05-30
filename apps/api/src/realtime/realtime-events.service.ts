import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private server?: Server;
  private connectedClients = 0;
  private seenClient = false;
  private lastZeroClientAt: number | undefined;

  bind(server: Server) {
    this.server = server;
  }

  publish<T>(event: string, payload: T): T {
    if (!this.server) {
      this.logger.debug(`Realtime server not ready for ${event}`);
      return payload;
    }
    this.server.emit(event, payload);
    return payload;
  }

  clientConnected() {
    this.seenClient = true;
    this.connectedClients += 1;
    this.lastZeroClientAt = undefined;
  }

  clientDisconnected() {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    if (this.connectedClients === 0) {
      this.lastZeroClientAt = Date.now();
    }
  }

  getClientCount() {
    return this.connectedClients;
  }

  hasSeenClient() {
    return this.seenClient;
  }

  isFrontendConnectionLost(graceMs = 15_000) {
    if (!this.seenClient || this.connectedClients > 0 || this.lastZeroClientAt === undefined) {
      return false;
    }
    return Date.now() - this.lastZeroClientAt >= graceMs;
  }
}
