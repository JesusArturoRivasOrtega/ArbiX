import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private available = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.available = true;
      this.logger.log("Connected to PostgreSQL through Prisma");
    } catch (error) {
      this.available = false;
      this.logger.warn(`Prisma is running in optional mode: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.available) {
      await this.$disconnect();
    }
  }

  isAvailable() {
    return this.available;
  }
}
