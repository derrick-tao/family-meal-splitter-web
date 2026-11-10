import { DEFAULT_TITLE, readBill } from "./validation";
export { DEFAULT_TITLE } from "./validation";
export type PercentageOverride = boolean;
export type AdultCount = number;
export interface Child {
  id: string;
  name: string;
  age: number | null;
  percentage: number;
  overridden: PercentageOverride;
}
export interface Household {
  id: string;
  name: string;
  adults: AdultCount;
  children: Child[];
}
export type Tone = "fun" | "simple";
export interface Bill {
  title: string;
  amount: string;
  households: Household[];
  tone: Tone;
}
export interface Allocation {
  id: string;
  weight: number;
  cents: number;
}
export const STORAGE_KEY = "family-meal-splitter-v1";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const cleanBill = (): Bill => ({
  title: DEFAULT_TITLE,
  amount: "0.00",
  households: [],
  tone: "fun",
});
export function ageDefault(age: number | null): number {
  if (age === null || !Number.isInteger(age) || age < 0 || age > 17) return 0;
  return [
    0, 10, 20, 25, 25, 30, 30, 35, 40, 50, 60, 70, 80, 90, 100, 100, 100, 100,
  ][age];
}
export function updateChild(child: Child, patch: Partial<Child>): Child {
  const next = { ...child, ...patch };
  if ("percentage" in patch) next.overridden = true;
  if ("age" in patch && !next.overridden)
    next.percentage = ageDefault(next.age);
  return next;
}
export const resetChild = (child: Child): Child => ({
  ...child,
  percentage: ageDefault(child.age),
  overridden: false,
});
export function parseCents(value: string): number | null {
  if (value.trim() === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 99999999999 ? cents : null;
}
export const householdWeight = (h: Household) =>
  h.adults * 100 + h.children.reduce((sum, c) => sum + c.percentage, 0);
export function allocate(cents: number, households: Household[]): Allocation[] {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error("Enter a valid bill amount.");
  const weights = households.map(householdWeight);
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0))
    throw new Error("Portions must be nonnegative integers.");
  const total = weights.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("The total portion is too large.");
  if (!total && cents)
    throw new Error(
      "Add at least one adult or a child with a portion above 0% to split the bill.",
    );
  const denominator = BigInt(total || 1);
  const rows = weights.map((weight, i) => {
    const numerator = BigInt(cents) * BigInt(weight);
    return {
      id: households[i].id,
      weight,
      cents: Number(numerator / denominator),
      remainder: numerator % denominator,
      index: i,
    };
  });
  const remaining = cents - rows.reduce((sum, r) => sum + r.cents, 0);
  [...rows]
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    )
    .slice(0, remaining)
    .forEach((r) => r.cents++);
  return rows.map(({ id, weight, cents }) => ({ id, weight, cents }));
}
export const householdName = (h: Household, i: number) =>
  h.name.trim() || `Household ${i + 1}`;
export const childName = (c: Child, i: number) =>
  c.name.trim() || `Child ${i + 1}`;
export function generateMessage(bill: Bill, rows: Allocation[]): string {
  const cents = parseCents(bill.amount);
  if (cents === null)
    return "Enter a valid bill amount to prepare your message.";
  if (!bill.households.length || (cents > 0 && !rows.length))
    return "Add households and their portions to prepare your message.";
  const fun = bill.tone === "fun";
  const intro = fun
    ? `🎉🍽️ ${billTitle(bill)} — Bill Breakdown!\n\nHi everyone! 👋 Our dinner together came to ` +
      money(cents) +
      "! 🥗"
    : billTitle(bill) +
      " — Bill breakdown\n\nTotal dinner bill: " +
      money(cents);
  const details = bill.households
    .map(
      (h, i) =>
        `${fun ? "🏡 " : ""}${householdName(h, i)} — ${money(rows[i]?.cents ?? 0)}\nAdults: ${h.adults} × 100% = ${h.adults * 100}%${h.children.map((c, j) => `\n${fun ? "🧒 " : ""}${childName(c, j)}: ${c.percentage}%`).join("")}`,
    )
    .join("\n\n");
  return `${intro}\n\nEvery adult counts as 100%. Children’s percentages are adjustable estimates of how much they ate relative to an adult portion. ${fun ? "🍴✨" : ""}\n\n${details}\n\n${fun ? "💰 " : ""}GRAND TOTAL: ${money(cents)}${fun ? " ✅" : ""}\n\nEach household pays in proportion to its combined portions. Whole-cent rounding makes the payments add up exactly.\n\n${fun ? "💕 Thanks for the food, laughter, and lovely company! Until our next dinner! 😋🎉" : "Thank you for a lovely dinner together!"} `.trim();
}
export function exampleBill(): Bill {
  const specs = [[4, 6], [], [4, 8, 10], [2, 5]];
  return {
    title: DEFAULT_TITLE,
    amount: "254.74",
    tone: "fun",
    households: specs.map((ages, i) => ({
      id: `example-${i}`,
      name: `Family ${"ABCD"[i]}`,
      adults: 1,
      children: ages.map((age, j) => ({
        id: `example-${i}-${j}`,
        name: `Child ${"ABCD"[i]}${j + 1}`,
        age,
        percentage: ageDefault(age),
        overridden: false,
      })),
    })),
  };
}
export function isBill(value: unknown): value is Bill {
  try {
    readBill(value);
    return true;
  } catch {
    return false;
  }
}
export const billTitle = (bill: Bill) => bill.title.trim() || DEFAULT_TITLE;
