import { allocate, parseCents, type Bill } from "./meal";
import {
  boundedJson,
  isSafeText,
  MAX_SHARE_BYTES,
  MAX_SHARE_URL,
  readBill,
  record,
} from "./validation";
export type NamePrivacy = "initials" | "entered";
const prefix = "#share=v1.";
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .flatMap((part) => {
      const match = part.match(/[\p{L}\p{N}]/u);
      if (!match) return [];
      const upper = match[0].toLocaleUpperCase("en-US");
      return [(Array.from(upper).length === 1 ? upper : match[0]) + "."];
    })
    .join(" ");
}
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function requireShareable(bill: Bill): Bill {
  const clean = readBill(bill, true);
  const cents = parseCents(clean.amount);
  if (cents === null)
    throw new Error("Enter a valid bill amount before sharing.");
  if (!clean.households.length)
    throw new Error("Add a household before sharing.");
  allocate(cents, clean.households);
  return clean;
}
export function createShareUrl(
  bill: Bill,
  privacy: NamePrivacy,
  origin: string,
  basePath: string,
): string {
  if (privacy !== "initials" && privacy !== "entered")
    throw new Error("Choose a sharing option.");
  const clean = requireShareable(bill);
  const snapshot: Bill = {
    title: clean.title,
    amount: clean.amount,
    tone: clean.tone,
    households: clean.households.map((h, i) => ({
      id: `h${i}`,
      name: h.name,
      adults: h.adults,
      children: h.children.map((c, j) => ({
        id: `h${i}c${j}`,
        name: privacy === "initials" ? initials(c.name) : c.name,
        age: c.age,
        percentage: c.percentage,
        overridden: c.overridden,
      })),
    })),
  };
  requireShareable(snapshot);
  const raw = JSON.stringify({ version: 1, bill: snapshot });
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length > MAX_SHARE_BYTES)
    throw new Error(
      "This dinner is too large to share. Reduce the included text or participants.",
    );
  // origin/basePath are trusted deployment inputs, never imported snapshot fields.
  const trusted = new URL(origin);
  if (
    !["https:", "http:"].includes(trusted.protocol) ||
    trusted.username ||
    trusted.password
  )
    throw new Error("Unsupported app origin.");
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath))
    throw new Error("Unsupported app path.");
  const url = new URL(basePath, trusted.origin);
  url.hash = prefix + encode(bytes);
  if (url.href.length > MAX_SHARE_URL)
    throw new Error(
      "This dinner is too large to share. Reduce names, included text, or participants.",
    );
  return url.href;
}
export function decodeShareUrl(
  href: string,
): { bill: Bill; hash: string } | null {
  const url = new URL(href);
  if (!url.hash) return null;
  if (href.length > MAX_SHARE_URL)
    throw new Error(
      "This shared dinner link is too large. Your saved dinners are unchanged.",
    );
  if (!url.hash.startsWith("#share=")) {
    if (url.hash === "#your-split") return null;
    throw new Error(
      "This shared dinner link is not supported. Your saved dinners are unchanged.",
    );
  }
  if (!url.hash.startsWith(prefix))
    throw new Error(
      "This shared dinner version is not supported. Your saved dinners are unchanged.",
    );
  const encoded = url.hash.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1)
    throw new Error(
      "This shared dinner link is invalid. Your saved dinners are unchanged.",
    );
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (bytes.length > MAX_SHARE_BYTES || encode(bytes) !== encoded)
      throw new Error();
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const data = record(boundedJson(raw, MAX_SHARE_BYTES), ["version", "bill"]);
    if (data.version !== 1) throw new Error();
    return {
      bill: requireShareable(readBill(data.bill, true)),
      hash: url.hash,
    };
  } catch {
    throw new Error(
      "This shared dinner link is invalid. Your saved dinners are unchanged.",
    );
  }
}
export function canShare(bill: Bill): boolean {
  try {
    requireShareable(bill);
    return true;
  } catch {
    return false;
  }
}
export async function snapshotDigest(hash: string): Promise<string> {
  if (!isSafeText(hash, MAX_SHARE_URL)) throw new Error("Invalid snapshot.");
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(hash),
  );
  return [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
