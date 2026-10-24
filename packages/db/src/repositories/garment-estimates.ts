import type { EstimateVersion } from "@aarili/contracts/garment-estimates";
export interface GarmentEstimatesRepository {
  lock(id: string): Promise<void>;
  current(id: string): Promise<EstimateVersion | undefined>;
  read(id: string): Promise<EstimateVersion | undefined>;
  history(id: string, before?: number): Promise<EstimateVersion[]>;
  append(
    input: Omit<EstimateVersion, "id" | "recordedAt" | "contentHash"> & {
      key: string;
      requestId: string;
    },
  ): Promise<EstimateVersion>;
  origin(id: string, draftId: string): Promise<boolean>;
}
