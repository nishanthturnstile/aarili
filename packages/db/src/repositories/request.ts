import type { Actor } from "@aarili/contracts/request";
export type RequestBinding = { actor: Actor; action: string; hash: string };
export type StoredResponse<T> = RequestBinding & { response: T; status: 200 };
// Bound to one verified shop transaction; response validation belongs to caller.
export interface RequestRepository<T> {
  lockKey(key: string): Promise<void>;
  replay(key: string): Promise<StoredResponse<unknown> | undefined>;
  persist(key: string, binding: RequestBinding, response: T): Promise<void>;
  expiredKeys(cutoff: Date): Promise<string[]>;
}
