// Framework/driver-free interfaces: implementations bind the request transaction.
export type ShopRecord = { shopId: string; name: string };
export interface ShopRepository {
  read(shopId: string): Promise<ShopRecord | undefined>;
}
