import { Global, Module } from "@nestjs/common";
import { OrderBookStore } from "./order-book.store.js";

@Global()
@Module({
  providers: [OrderBookStore],
  exports: [OrderBookStore]
})
export class OrderBookStoreModule {}
