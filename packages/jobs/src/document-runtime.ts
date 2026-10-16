import type { DocumentContext } from "@aarili/core/documents";
import type { Transaction } from "@aarili/db";
import { createDocumentRenderer } from "@aarili/documents";

// Explicit native composition entry. Ordinary job registration imports only
// locators/transaction adapters, keeping the browser SDK and local font loader
// out of inactive web instrumentation. Both job modes accept this same value.
export function createDocumentRuntime(
  adapters: (
    tx: Transaction,
    shopId: string,
    userId: string,
  ) => Pick<DocumentContext, "policy" | "storage" | "jobs">,
  registry: Parameters<typeof createDocumentRenderer>[0],
) {
  const renderer = createDocumentRenderer(registry);
  return {
    adapters: (tx: Transaction, shopId: string, userId: string) => ({
      ...adapters(tx, shopId, userId),
      templates: registry,
    }),
    renderer,
    close: () => renderer.close(),
  };
}
