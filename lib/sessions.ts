import type { Bill } from "./meal";
import { decodeShareUrl } from "./sharing";
import { boundedJson, MAX_DRAFT_BYTES, readBill, record } from "./validation";

export const SESSION_STORAGE_KEY = "family-meal-splitter-session-v1";
export const SHARED_STORAGE_KEY = "family-meal-splitter-shared-v1";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface LocalSession {
  version: 1;
  id: string;
  baseline: Bill;
  current: Bill;
  source?: string;
}
export const sameBill = (a: Bill, b: Bill) =>
  JSON.stringify(a) === JSON.stringify(b);
export const cloneBill = (bill: Bill): Bill => readBill(bill);
export function draftSelector(href: string): string | null {
  const url = new URL(href);
  const ids = url.searchParams.getAll("draft");
  if (!ids.length) return null;
  if (ids.length !== 1 || !uuid.test(ids[0]) || url.hash)
    throw new Error(
      "This local copy address is invalid or ambiguous. Your saved dinners are unchanged.",
    );
  return ids[0];
}
export function readSession(value: unknown): LocalSession {
  const data = record(
    value,
    ["version", "id", "baseline", "current"],
    ["source"],
  );
  if (data.version !== 1 || typeof data.id !== "string" || !uuid.test(data.id))
    throw new Error("Invalid local copy.");
  const baseline = readBill(data.baseline),
    current = readBill(data.current);
  const result: LocalSession = { version: 1, id: data.id, baseline, current };
  if (Object.hasOwn(data, "source")) {
    if (
      typeof data.source !== "string" ||
      !data.source.startsWith("#share=v1.")
    )
      throw new Error("Invalid original snapshot.");
    const incoming = decodeShareUrl(`https://local.invalid/${data.source}`);
    if (!incoming || !sameBill(incoming.bill, baseline))
      throw new Error(
        "Local copy baseline does not match its original snapshot.",
      );
    result.source = incoming.hash;
  }
  return result;
}
export function parseSession(raw: string): LocalSession {
  return readSession(boundedJson(raw));
}
export function serializeSession(session: LocalSession): string {
  const raw = JSON.stringify(readSession(session));
  if (new TextEncoder().encode(raw).length > MAX_DRAFT_BYTES)
    throw new Error(
      "This local copy is too large to save. Your last saved copy is preserved.",
    );
  return raw;
}
export function newSession(
  baseline: Bill,
  source?: string,
  current = baseline,
): LocalSession {
  return readSession({
    version: 1,
    id: crypto.randomUUID(),
    baseline: cloneBill(baseline),
    current: cloneBill(current),
    ...(source ? { source } : {}),
  });
}
export function appUrl(
  origin: string,
  basePath: string,
  selector?: { id: string } | { source: string },
): string {
  const trusted = new URL(origin);
  if (
    !["http:", "https:"].includes(trusted.protocol) ||
    trusted.username ||
    trusted.password ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)
  )
    throw new Error("Unsupported app address.");
  const url = new URL(basePath, trusted.origin);
  if (selector && "id" in selector) {
    if (!uuid.test(selector.id))
      throw new Error("Invalid local copy identifier.");
    url.searchParams.set("draft", selector.id);
  } else if (selector) {
    if (!selector.source.startsWith("#share=v1."))
      throw new Error("Invalid snapshot.");
    const incoming = decodeShareUrl(`${url.href}${selector.source}`);
    if (!incoming) throw new Error("Invalid snapshot.");
    url.hash = incoming.hash;
  }
  return url.href;
}
