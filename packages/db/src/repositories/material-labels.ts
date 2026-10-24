import type {
  MaterialLabelHistory,
  MaterialLabelModel,
  MaterialLabelSelection,
} from "@aarili/contracts/material-labels";
export type MaterialLabelSource = {
  orderId: string;
  pieceId: string | null;
  customerId: string;
  wearerId: string | null;
  kind: "custom" | "service";
  version: number;
  digest: string;
  orderCode: string;
  garment: { en: string; ta: string };
  pieceName: { en: string; ta: string } | null;
  sourceOrderId: string | null;
  sourcePieceId: string | null;
};
export type MaterialLabelBinding = {
  docId: string;
  revision: number;
  selectionHash: string;
  sourceDigest: string;
  commandHash: string;
  modelHash: string;
  revoked: boolean;
};
export interface MaterialLabelsRepository {
  lock(): Promise<void>;
  candidateOrderIds(before?: string): Promise<string[]>;
  pieceIds(orderId: string): Promise<string[]>;
  lockOrders(ids: string[]): Promise<void>;
  source(
    orderId: string,
    pieceId: string | null,
  ): Promise<MaterialLabelSource | undefined>;
  binding(
    docId: string,
    revision: number,
  ): Promise<MaterialLabelBinding | undefined>;
  members(docId: string, revision: number): Promise<MaterialLabelSource[]>;
  history(selectionHash: string): Promise<MaterialLabelHistory[]>;
  bind(
    binding: MaterialLabelBinding,
    selections: MaterialLabelSelection[],
    sources: MaterialLabelSource[],
  ): Promise<void>;
  model(
    docId: string,
    revision: number,
  ): Promise<MaterialLabelModel | undefined>;
}
