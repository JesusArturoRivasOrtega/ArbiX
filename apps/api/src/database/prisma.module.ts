import { Global, Module } from "@nestjs/common";
import { PersistenceService } from "./persistence.service.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [PrismaService, PersistenceService],
  exports: [PrismaService, PersistenceService]
})
export class DatabaseModule {}
