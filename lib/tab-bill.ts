import { cleanBill, type Bill } from "./meal";
import { boundedJson, MAX_DRAFT_BYTES, readBill, record } from "./validation";

// Legacy keys are recovery sources only. No tab writes into browser-wide data.
export const TAB_BILL_KEY = "family-meal-splitter-tab-bill-v2";
export interface TabBill {
  version: 2;
  bill: Bill;
}
export function readTabBill(value: unknown): TabBill {
  const data = record(value, ["version", "bill"]);
  if (data.version !== 2) throw new Error("Unsupported tab bill.");
  return { version: 2, bill: readBill(data.bill) };
}
export const parseTabBill = (raw: string): TabBill =>
  readTabBill(boundedJson(raw));
export function serializeTabBill(bill: Bill): string {
  const raw = JSON.stringify(readTabBill({ version: 2, bill }));
  if (new TextEncoder().encode(raw).length > MAX_DRAFT_BYTES)
    throw new Error("This bill is too large to save in this tab.");
  return raw;
}
export function hasWork(bill: Bill): boolean {
  return (
    JSON.stringify(readBill(bill)) !== JSON.stringify(readBill(cleanBill()))
  );
}
