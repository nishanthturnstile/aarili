import { allocateFin05, type AllocationResult } from "@aarili/money";
allocateFin05("100", [{ lineId: "a", chargePaise: 1 }]);
allocateFin05(100, [{ lineId: "a", chargePaise: 1n }]);
allocateFin05(100, [{ chargePaise: 1 }]);
allocateFin05(100, [{ lineId: "a" }]);
const result: AllocationResult = { allocations: [], unallocatedPaise: "1" };
allocateFin05(100, [{ lineId: "a", chargePaise: 1, order: 1 }]);
