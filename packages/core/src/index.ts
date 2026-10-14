import type { ShopRepository } from "@aarili/db/repositories/shop";

// TRU-01 / AC-38: repository already belongs to the authorised shop transaction.
export function readShop(repository: ShopRepository, shopId: string) {
  return repository.read(shopId);
}
