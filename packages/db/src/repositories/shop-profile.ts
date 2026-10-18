import type {
  ShopProfileInput,
  ShopProfileRevision,
} from "@aarili/contracts/shop-profile";
import type { RequestRepository } from "./request.js";

export interface ShopProfileRepository extends RequestRepository<unknown> {
  lock(): Promise<void>;
  initialName(): Promise<string | undefined>;
  current(): Promise<ShopProfileRevision | undefined>;
  history(before?: number): Promise<ShopProfileRevision[]>;
  read(id: string): Promise<ShopProfileRevision | undefined>;
  append(input: {
    profile: ShopProfileInput;
    version: number;
    previousId: string | null;
    actorId: string;
    key: string;
    requestId: string;
    baseline: boolean;
  }): Promise<ShopProfileRevision>;
  advance(
    revision: ShopProfileRevision,
    expected: number | null,
  ): Promise<boolean>;
  logoReady(id: string): Promise<boolean>;
}
