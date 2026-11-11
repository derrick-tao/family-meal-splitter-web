import { describe, expect, it } from "vitest";
import { cleanBill, exampleBill } from "../lib/meal";
import { createShareUrl, decodeShareUrl } from "../lib/sharing";
import {
  appUrl,
  draftSelector,
  newSession,
  parseSession,
  readSession,
  serializeSession,
} from "../lib/sessions";
import { MAX_DRAFT_BYTES } from "../lib/validation";
const origin = "https://app.example",
  base = "/family-meal-splitter-web/";
const source = new URL(createShareUrl(exampleBill(), "entered", origin, base))
  .hash;
const original = () => decodeShareUrl(origin + base + source)!.bill;
describe("local session addresses", () => {
  it("generates a canonical UUID pointer without data, fragment, or unrelated query", () => {
    const session = newSession(cleanBill());
    const url = appUrl(origin + "/?return=bad#bad", base, { id: session.id });
    expect(draftSelector(url)).toBe(session.id);
    expect(new URL(url).hash).toBe("");
    expect(new URL(url).search).toBe("?draft=" + session.id);
    expect(draftSelector(origin + base + "?return=bad")).toBeNull();
  });
  it.each([
    "",
    "../secret",
    "a".repeat(500),
    "00000000-0000-0000-0000-000000000000",
    "12345678-1234-4234-8234-123456789ABc",
  ])("rejects malformed UUID %s", (id) => {
    expect(() => draftSelector(origin + base + "?draft=" + id)).toThrow();
    expect(() => appUrl(origin, base, { id })).toThrow();
  });
  it("rejects duplicate selectors and every draft-fragment combination", () => {
    const id = newSession(cleanBill()).id;
    for (const suffix of ["&draft=" + id, "&draft=bad", source, "#your-split"])
      expect(() =>
        draftSelector(origin + base + "?draft=" + id + suffix),
      ).toThrow();
  });
  it("reconstructs source navigation only from a validated fragment at the trusted base", () => {
    expect(appUrl(origin + "/untrusted?x=1", base, { source })).toBe(
      origin + base + source,
    );
    for (const value of [
      "https://evil.example/",
      "#your-split",
      "#share=v1.bad",
    ])
      expect(() => appUrl(origin, base, { source: value })).toThrow();
  });
});
describe("untrusted session records", () => {
  it("clones independent baseline and current values and preserves incomplete edits", () => {
    const bill = original(),
      session = newSession(bill, source);
    bill.title = "Family B";
    session.current.title = "Family A edited";
    session.current.amount = "incomplete";
    session.current.households[0].children[1].percentage = 50;
    expect(session.baseline).toEqual(original());
    expect(parseSession(serializeSession(session))).toEqual(session);
    expect(parseSession(serializeSession(session)).current.amount).toBe(
      "incomplete",
    );
  });
  it("requires the baseline to agree with the validated original including all fields", () => {
    for (const field of ["title", "amount", "tone"] as const) {
      const session = newSession(original(), source);
      if (field === "tone") session.baseline.tone = "simple";
      else session.baseline[field] = "changed";
      expect(() => serializeSession(session)).toThrow();
    }
    const session = newSession(original(), source);
    session.baseline.households[0].children[0].overridden = true;
    expect(() => serializeSession(session)).toThrow();
  });
  it.each([null, [], {}, { version: 2 }, "not-json"])(
    "rejects corrupt records %#",
    (value) => {
      expect(() => readSession(value)).toThrow();
      expect(() =>
        parseSession(typeof value === "string" ? value : JSON.stringify(value)),
      ).toThrow();
    },
  );
  it("rejects unexpected and dangerous fields throughout the record", () => {
    const session = newSession(cleanBill());
    expect(() =>
      readSession({ ...session, redirect: "https://evil.example/" }),
    ).toThrow();
    expect(() =>
      readSession({
        ...session,
        current: { ...session.current, constructor: "bad" },
      }),
    ).toThrow();
    expect(() =>
      readSession({ ...session, source: "https://evil.example/" }),
    ).toThrow();
  });
  it("counts baseline and current together against the 1 MiB byte ceiling", () => {
    const session = newSession(exampleBill());
    session.baseline.households[0].name = "A".repeat(MAX_DRAFT_BYTES / 2);
    session.current.households[0].name = "B".repeat(MAX_DRAFT_BYTES / 2);
    expect(() => serializeSession(session)).toThrow("too large");
    expect(() => parseSession(" ".repeat(MAX_DRAFT_BYTES) + "{}")).toThrow(
      "too large",
    );
  });
});
