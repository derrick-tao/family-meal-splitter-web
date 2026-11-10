import { describe, it, expect } from "vitest";
import {
  ageDefault,
  allocate,
  cleanBill,
  exampleBill,
  generateMessage,
  householdWeight,
  isBill,
  parseCents,
  resetChild,
  updateChild,
  type Household,
} from "../lib/meal";
const household = (id: string, adults = 1): Household => ({
  id,
  name: `Family ${id}`,
  adults,
  children: [],
});
describe("portion suggestions", () => {
  it("maps every age and rejects incomplete ages", () => {
    expect(Array.from({ length: 18 }, (_, i) => ageDefault(i))).toEqual([
      0, 10, 20, 25, 25, 30, 30, 35, 40, 50, 60, 70, 80, 90, 100, 100, 100, 100,
    ]);
    for (const age of [null, -1, 18, 2.5]) expect(ageDefault(age)).toBe(0);
  });
  it("keeps overrides independent and preserves them after age edits", () => {
    const [first, second] = exampleBill().households[0].children;
    const edited = updateChild(first, { percentage: 50 });
    expect(updateChild(edited, { age: 10 }).percentage).toBe(50);
    expect(second.percentage).toBe(30);
    expect(resetChild({ ...edited, age: 10 })).toMatchObject({
      percentage: 60,
      overridden: false,
    });
    expect(updateChild(second, { age: 8 }).percentage).toBe(40);
  });
});
describe("bill input", () => {
  it.each([
    ["", 0],
    ["0", 0],
    ["0.00", 0],
    ["254.74", 25474],
    ["1.1", 110],
    ["1.", 100],
    ["-1", null],
    ["abc", null],
    ["NaN", null],
    ["Infinity", null],
    ["1.001", null],
    ["99999999999999", null],
  ])("parses %s safely", (input, expected) =>
    expect(parseCents(input as string)).toBe(expected),
  );
});
describe("exact financial allocation", () => {
  it("computes weights and multiple adults", () => {
    const h = exampleBill().households[0];
    expect(householdWeight(h)).toBe(155);
    expect(householdWeight({ ...h, adults: 2 })).toBe(255);
    expect(
      allocate(300, [household("A", 2), household("B")]).map((r) => r.cents),
    ).toEqual([200, 100]);
  });
  it("matches the fictional dinner exactly", () => {
    const b = exampleBill();
    expect(allocate(25474, b.households).map((r) => r.cents)).toEqual([
      6267, 4044, 9098, 6065,
    ]);
  });
  it("breaks ties by stable household order", () => {
    expect(
      allocate(
        2,
        ["A", "B", "C"].map((id) => household(id)),
      ).map((r) => r.cents),
    ).toEqual([1, 1, 0]);
  });
  it("never creates or loses pennies", () => {
    for (let cents = 0; cents < 200; cents++)
      expect(
        allocate(cents, exampleBill().households).reduce(
          (s, r) => s + r.cents,
          0,
        ),
      ).toBe(cents);
  });
  it("handles zero amounts and weights", () => {
    expect(allocate(0, [])).toEqual([]);
    expect(allocate(0, [household("A", 0)])[0].cents).toBe(0);
    expect(() => allocate(1, [household("A", 0)])).toThrow("above 0%");
    expect(() => allocate(-1, [])).toThrow();
    expect(() => allocate(1, [household("A", -1)])).toThrow();
  });
  it("recalculates a slider change and the exact message consistently", () => {
    const b = exampleBill();
    b.households[0].children[1] = updateChild(b.households[0].children[1], {
      percentage: 50,
    });
    const rows = allocate(25474, b.households);
    expect(rows.map((r) => r.cents)).toEqual([6858, 3919, 8818, 5879]);
    const text = generateMessage(b, rows);
    expect(text).toContain("Child A2: 50%");
    expect(text).toContain("Family A — $68.58");
    expect(text).toContain("GRAND TOTAL: $254.74");
    expect(text).not.toMatch(/\bages?\b|\*\*/i);
  });
});
describe("message and persistence", () => {
  it("includes all households and children in both tones and multiple adults", () => {
    const b = exampleBill();
    b.households[1].adults = 2;
    for (const tone of ["fun", "simple"] as const) {
      b.tone = tone;
      const rows = allocate(25474, b.households),
        text = generateMessage(b, rows);
      expect(text).toContain("Adults: 2 × 100% = 200%");
      b.households.forEach((h, i) => {
        expect(text).toContain(h.name);
        h.children.forEach((c) =>
          expect(text).toContain(`${c.name}: ${c.percentage}%`),
        );
        expect(text).toContain((rows[i].cents / 100).toFixed(2));
      });
    }
  });
  it("handles incomplete input and missing names", () => {
    const b = cleanBill();
    expect(generateMessage(b, [])).toContain("Add households");
    b.amount = "invalid";
    expect(generateMessage(b, [])).toContain("valid bill");
    b.amount = "0";
    b.households = [household("", 0)];
    b.households[0].name = "";
    expect(generateMessage(b, allocate(0, b.households))).toContain(
      "Household 1",
    );
  });
  it("validates saved state and rejects corrupt IDs and values", () => {
    expect(isBill(exampleBill())).toBe(true);
    expect(isBill(null)).toBe(false);
    expect(isBill({})).toBe(false);
    const b = exampleBill();
    b.households[0].children[0].percentage = NaN;
    expect(isBill(b)).toBe(false);
    const c = exampleBill();
    c.households[1].id = c.households[0].id;
    expect(isBill(c)).toBe(false);
  });
});
