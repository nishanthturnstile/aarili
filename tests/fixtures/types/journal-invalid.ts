import { postJournal, reversalEntries } from "@aarili/core/journal";
import type { JournalRepository } from "@aarili/db/repositories/journal";
declare const repository: JournalRepository;
reversalEntries([{ account: "cash", amountPaise: "100" }]);
reversalEntries([{ account: "balance", amountPaise: 100 }]);
postJournal(repository, "actor", { sourceId: "id" }, { key: "key", requestId: "id" });
repository.setBalance("id", 100);
repository.positions(100);
