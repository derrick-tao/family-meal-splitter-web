import type { Bill, Household } from "./meal";
export const DEFAULT_TITLE = "Dinner bill";
export const MAX_DRAFT_BYTES = 1024 * 1024;
export const MAX_SHARE_BYTES = 256 * 1024;
export const MAX_SHARE_URL = 8000;
export const MAX_SHARE_ENTITIES = 200;
const controls =
  /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;
export function isSafeText(value: unknown, max = 120): value is string {
  if (typeof value !== "string" || controls.test(value)) return false;
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) return false;
    if (++length > max) return false;
  }
  return true;
}
export function record(
  value: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid dinner structure.");
  const result = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  if (
    Object.keys(result).some((key) => !allowed.has(key)) ||
    required.some((key) => !Object.hasOwn(result, key))
  )
    throw new Error("Unexpected or missing dinner fields.");
  return result;
}
function integer(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
/** Explicit DTO reconstruction: no imported properties are merged into runtime objects. */
export function readBill(value: unknown, shared = false, legacy = false): Bill {
  const b = record(
    value,
    legacy
      ? ["amount", "households", "tone"]
      : ["title", "amount", "households", "tone"],
    legacy ? ["title"] : [],
  );
  const title = legacy && !Object.hasOwn(b, "title") ? DEFAULT_TITLE : b.title;
  if (
    !isSafeText(title) ||
    !isSafeText(b.amount, 128) ||
    (b.tone !== "fun" && b.tone !== "simple") ||
    !Array.isArray(b.households)
  )
    throw new Error("Invalid dinner values.");
  const ids = new Set<string>();
  const id = (value: unknown) => {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(value) ||
      ids.has(value)
    )
      throw new Error("Invalid or duplicate participant identifier.");
    ids.add(value);
    return value;
  };
  let entities = b.households.length;
  if (shared && entities > MAX_SHARE_ENTITIES)
    throw new Error(
      "This dinner is too large to share. Reduce the included text or participants.",
    );
  const households: Household[] = b.households.map((value) => {
    const h = record(value, ["id", "name", "adults", "children"]);
    if (
      !isSafeText(h.name, shared ? 120 : MAX_DRAFT_BYTES) ||
      !integer(h.adults, 1000) ||
      !Array.isArray(h.children)
    )
      throw new Error("Invalid household values.");
    const householdId = id(h.id);
    entities += h.children.length;
    if (shared && entities > MAX_SHARE_ENTITIES)
      throw new Error(
        "This dinner is too large to share. Reduce the included text or participants.",
      );
    return {
      id: householdId,
      name: h.name,
      adults: h.adults,
      children: h.children.map((value) => {
        const c = record(value, [
          "id",
          "name",
          "age",
          "percentage",
          "overridden",
        ]);
        if (
          !isSafeText(c.name, shared ? 120 : MAX_DRAFT_BYTES) ||
          (c.age !== null && !integer(c.age, 17)) ||
          !integer(c.percentage, 100) ||
          c.percentage % 5 !== 0 ||
          typeof c.overridden !== "boolean"
        )
          throw new Error("Invalid child values.");
        return {
          id: id(c.id),
          name: c.name,
          age: c.age as number | null,
          percentage: c.percentage,
          overridden: c.overridden,
        };
      }),
    };
  });
  return { title, amount: b.amount, tone: b.tone, households };
}
export function boundedJson(raw: string, max = MAX_DRAFT_BYTES): unknown {
  if (raw.length > max || new TextEncoder().encode(raw).length > max)
    throw new Error(
      "Saved dinner is too large. Existing data has been preserved.",
    );
  // Bound container depth before parsing, ignoring brackets within quoted JSON strings.
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const char of raw) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{" || char === "[") {
      if (++depth > 8) throw new Error("Dinner nesting is too deep.");
    } else if (char === "}" || char === "]") depth--;
  }
  return JSON.parse(raw);
}
export const parseDraft = (raw: string) =>
  readBill(boundedJson(raw), false, true);
export function serializeDraft(bill: Bill): string {
  const raw = JSON.stringify(readBill(bill));
  if (new TextEncoder().encode(raw).length > MAX_DRAFT_BYTES)
    throw new Error(
      "This dinner is too large to save. Your last saved draft is preserved.",
    );
  return raw;
}
