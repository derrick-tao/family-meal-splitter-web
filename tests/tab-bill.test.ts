import { describe, expect, it } from "vitest";
import { cleanBill, exampleBill, STORAGE_KEY } from "../lib/meal";
import { SESSION_STORAGE_KEY, SHARED_STORAGE_KEY } from "../lib/sessions";
import {
  hasWork,
  parseTabBill,
  readTabBill,
  serializeTabBill,
  TAB_BILL_KEY,
} from "../lib/tab-bill";
import { MAX_DRAFT_BYTES } from "../lib/validation";

describe("independent tab bill storage", () => {
  it("uses a separate key and no source, baseline, or selector", () => {
    expect([
      STORAGE_KEY,
      SESSION_STORAGE_KEY,
      SHARED_STORAGE_KEY,
    ]).not.toContain(TAB_BILL_KEY);
    expect(JSON.parse(serializeTabBill(cleanBill()))).toEqual({
      version: 2,
      bill: cleanBill(),
    });
  });
  it("deep reconstructs all current values including incomplete edits and stable IDs", () => {
    const bill = exampleBill();
    bill.amount = "incomplete";
    bill.households[0].children[0].age = null;
    bill.households[0].children[1].percentage = 50;
    bill.households[0].children[1].overridden = true;
    const restored = parseTabBill(serializeTabBill(bill)).bill;
    expect(restored).toEqual(bill);
    restored.households[0].children[1].name = "Child A1";
    expect(restored).not.toEqual(bill);
  });
  it.each([
    null,
    [],
    {},
    { version: 1, bill: cleanBill() },
    { version: 2, bill: cleanBill(), source: "#share=v1.bad" },
    { version: 2, bill: { ...cleanBill(), constructor: "bad" } },
  ])("rejects malformed records %#", (value) => {
    expect(() => readTabBill(value)).toThrow();
  });
  it("enforces the whole record byte and depth limits", () => {
    expect(() => parseTabBill(" ".repeat(MAX_DRAFT_BYTES) + "{}")).toThrow();
    expect(() => parseTabBill("[".repeat(9) + "]".repeat(9))).toThrow();
    const bill = exampleBill();
    bill.households[0].name = "A".repeat(MAX_DRAFT_BYTES);
    expect(() => serializeTabBill(bill)).toThrow("too large");
  });
});
describe("replacement protection", () => {
  it("does not treat a clean reconstructed bill or property ordering as work", () => {
    expect(hasWork(cleanBill())).toBe(false);
    expect(hasWork(parseTabBill(serializeTabBill(cleanBill())).bill)).toBe(
      false,
    );
  });
  it.each([
    { title: "Family A" },
    { title: "" },
    { amount: "" },
    { amount: "0." },
    { tone: "simple" as const },
  ])("protects incomplete or small changes %#", (patch) => {
    expect(hasWork({ ...cleanBill(), ...patch })).toBe(true);
  });
  it("protects households even on a zero bill", () => {
    const bill = exampleBill();
    bill.amount = "0.00";
    expect(hasWork(bill)).toBe(true);
  });
});
