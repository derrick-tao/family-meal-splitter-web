import { describe, expect, it } from "vitest";
import {
  allocate,
  billTitle,
  cleanBill,
  exampleBill,
  generateMessage,
  parseCents,
  type Bill,
} from "../lib/meal";
import {
  canShare,
  createShareUrl,
  decodeShareUrl,
  initials,
  snapshotDigest,
} from "../lib/sharing";
import {
  boundedJson,
  DEFAULT_TITLE,
  isSafeText,
  MAX_DRAFT_BYTES,
  MAX_SHARE_BYTES,
  MAX_SHARE_ENTITIES,
  MAX_SHARE_URL,
  parseDraft,
  readBill,
  record,
  serializeDraft,
} from "../lib/validation";

const origin = "https://app.example";
const basePath = "/family-meal-splitter-web/";
const prefix = `${origin}${basePath}#share=v1.`;
const encodeBytes = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64url");
const encodeRaw = (raw: string) =>
  prefix + encodeBytes(new TextEncoder().encode(raw));
const encodeValue = (value: unknown) => encodeRaw(JSON.stringify(value));
const envelope = (bill: unknown = exampleBill()) => ({ version: 1, bill });
const roundTrip = (bill = exampleBill()) =>
  decodeShareUrl(createShareUrl(bill, "entered", origin, basePath))!.bill;
const payments = (bill: Bill) =>
  allocate(parseCents(bill.amount)!, bill.households).map((row) => row.cents);

describe("shareable snapshots", () => {
  it("round-trips the complete fictional dinner and exact cent allocation", () => {
    const bill = exampleBill();
    bill.title = "Family A–D dinner 🍽️";
    bill.tone = "simple";
    bill.households[0].children[1].percentage = 50;
    bill.households[0].children[1].overridden = true;
    const received = roundTrip(bill);
    expect(received).toMatchObject({
      title: bill.title,
      amount: "254.74",
      tone: "simple",
    });
    expect(received.households.map((household) => household.name)).toEqual(
      bill.households.map((household) => household.name),
    );
    expect(received.households[0].children).toEqual([
      { ...bill.households[0].children[0], id: "h0c0" },
      { ...bill.households[0].children[1], id: "h0c1" },
    ]);
    expect(payments(received)).toEqual([6858, 3919, 8818, 5879]);
    expect(payments(roundTrip())).toEqual([6267, 4044, 9098, 6065]);
  });

  it("produces an independent immutable snapshot, including blank names and ages", () => {
    const bill = exampleBill();
    bill.households[0].name = "";
    bill.households[0].children[0].name = "";
    bill.households[0].children[0].age = null;
    const url = createShareUrl(bill, "entered", origin, basePath);
    bill.title = "Changed dinner";
    bill.households[0].children[1].percentage = 50;
    const received = decodeShareUrl(url)!.bill;
    expect(received.title).toBe(DEFAULT_TITLE);
    expect(received.households[0].name).toBe("");
    expect(received.households[0].children[0]).toMatchObject({
      name: "",
      age: null,
    });
    expect(received.households[0].children[1].percentage).toBe(30);
    received.households[0].children[1].percentage = 75;
    expect(decodeShareUrl(url)!.bill.households[0].children[1].percentage).toBe(
      30,
    );
  });

  it("keeps participant order for stable penny-allocation ties", () => {
    const bill = exampleBill();
    bill.amount = "0.02";
    bill.households = bill.households
      .slice(0, 3)
      .map((household) => ({ ...household, children: [] }));
    expect(payments(roundTrip(bill))).toEqual([1, 1, 0]);
  });

  it("treats punctuation, percent escapes, markup, and URLs as inert data", () => {
    const bill = exampleBill();
    const text = '<script>&?redirect=javascript:alert(1)#%23/"';
    bill.title = text;
    bill.households[0].name = "//other.example/?x=1#2";
    bill.households[0].children[0].name = "<img src=x onerror=alert(1)>";
    bill.households[0].children[1].name = String.raw`&lt;script&gt; %2523 \u2028 javascript: data:`;
    const received = roundTrip(bill);
    expect(received.title).toBe(text);
    expect(received.households[0].name).toBe(bill.households[0].name);
    expect(received.households[0].children.map((child) => child.name)).toEqual(
      bill.households[0].children.map((child) => child.name),
    );
    expect(
      generateMessage(received, allocate(25474, received.households)),
    ).toContain(text);
  });

  it("creates links only at the trusted origin and deployment path, without query leakage", () => {
    const url = new URL(
      createShareUrl(
        exampleBill(),
        "entered",
        "https://app.example/unrelated?return=https://other.example#old",
        basePath,
      ),
    );
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe(basePath);
    expect(url.search).toBe("");
    expect(url.hash).toMatch(/^#share=v1\.[A-Za-z0-9_-]+$/);
    const altered = new URL(url);
    altered.search = "?return=https://other.example&amount=1&share=bad";
    expect(decodeShareUrl(altered.href)!.bill.amount).toBe("254.74");
    expect(decodeShareUrl(`${origin}${basePath}?share=anything`)).toBeNull();
    expect(decodeShareUrl(`${origin}${basePath}#your-split`)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,app",
    "file:///app",
    "https://user:password@app.example",
  ])("rejects an unsupported trusted-origin argument %s", (value) => {
    expect(() =>
      createShareUrl(exampleBill(), "entered", value, basePath),
    ).toThrow();
  });
  it.each([
    "//other.example/",
    "/../",
    "/app?x=1",
    "/app#next",
    "https://other.example/",
    "/app%2f/",
  ])("rejects an unsafe deployment path %s", (value) => {
    expect(() =>
      createShareUrl(exampleBill(), "entered", origin, value),
    ).toThrow();
  });

  it("allows zero dollars and zero weight but requires a household and valid nonzero allocation", () => {
    const bill = exampleBill();
    bill.amount = "0.00";
    bill.households = [{ id: "h0", name: "Family A", adults: 0, children: [] }];
    expect(canShare(bill)).toBe(true);
    expect(payments(roundTrip(bill))).toEqual([0]);
    bill.amount = "0.01";
    expect(canShare(bill)).toBe(false);
    expect(() => createShareUrl(bill, "entered", origin, basePath)).toThrow();
    expect(canShare(cleanBill())).toBe(false);
    for (const amount of [
      "-1",
      "NaN",
      "Infinity",
      "1e2",
      "1.001",
      "9999999999.99",
    ]) {
      bill.amount = amount;
      expect(canShare(bill)).toBe(false);
    }
  });
});

describe("name privacy", () => {
  it.each([
    ["Child A1", "C. A."],
    ["Child", "C."],
    [" Child   A1 ", "C. A."],
    ["C. A.", "C. A."],
    ["", ""],
    ["  ... -  ", ""],
    ["é Ω 字 7", "É. Ω. 字. 7."],
  ])("initializes %s predictably", (name, expected) => {
    expect(initials(name)).toBe(expected);
    expect(initials(initials(name))).toBe(expected);
  });

  it.each(["ß", "ﬀ", "ﬃ"])(
    "keeps uppercase-expanding Unicode initials stable for %s",
    (name) => {
      const abbreviated = initials(name);
      expect([...abbreviated.replace(/\.$/, "")]).toHaveLength(1);
      expect(initials(abbreviated)).toBe(abbreviated);
    },
  );

  it("abbreviates outgoing names only, retains ages and overrides, and removes original-name IDs", () => {
    const bill = exampleBill();
    bill.households[0].id = "Family_A";
    bill.households[0].children[0].name = "Child_A1";
    bill.households[0].children[0].id = "Child_A1";
    bill.households[0].children[0].percentage = 55;
    bill.households[0].children[0].overridden = true;
    const original = structuredClone(bill);
    const received = decodeShareUrl(
      createShareUrl(bill, "initials", origin, basePath),
    )!.bill;
    expect(bill).toEqual(original);
    expect(received.households[0].children[0]).toEqual({
      id: "h0c0",
      name: "C.",
      age: 4,
      percentage: 55,
      overridden: true,
    });
    expect(received.households[0].name).toBe("Family A");
    expect(JSON.stringify(received)).not.toContain("Child_A1");
    expect(JSON.stringify(received)).not.toContain("Child A2");
    expect(received.households[0].children[1]).toMatchObject({
      age: 6,
      name: "C. A.",
    });
    expect(
      received.households
        .flatMap((household) => [
          household.id,
          ...household.children.map((child) => child.id),
        ])
        .every((id) => /^h\d+(?:c\d+)?$/.test(id)),
    ).toBe(true);
    const twice = decodeShareUrl(
      createShareUrl(received, "initials", origin, basePath),
    )!.bill;
    expect(twice).toEqual(received);
    expect(
      decodeShareUrl(createShareUrl(received, "entered", origin, basePath))!
        .bill,
    ).toEqual(received);
  });
});

describe("fragment decoding and schema validation", () => {
  it.each([
    "#share=v2.abc",
    "#share=v1.",
    "#share=v1.A",
    "#share=v1.AB",
    "#share=v1.e30=",
    "#share=v1.e30&other=x",
    "#share=v1.e30#share=v1.e30",
    "#share=v1.%6530",
    "#share=v1.abc!",
    "#anything",
  ])("rejects malformed, noncanonical, or unsupported fragment %s", (hash) => {
    expect(() => decodeShareUrl(`${origin}${basePath}${hash}`)).toThrow();
  });

  it("rejects alternate Base64url pad bits even when they decode to valid JSON", () => {
    let raw = JSON.stringify(envelope());
    while (Buffer.byteLength(raw) % 3 === 0) raw += " ";
    const canonical = encodeBytes(new TextEncoder().encode(raw));
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = alphabet.indexOf(canonical.at(-1)!);
    const alias = canonical.slice(0, -1) + alphabet[last + 1];
    expect(Buffer.from(alias, "base64url")).toEqual(
      Buffer.from(canonical, "base64url"),
    );
    expect(() => decodeShareUrl(prefix + alias)).toThrow();
  });

  it("rejects invalid UTF-8 inside an otherwise valid JSON name", () => {
    const raw = JSON.stringify(envelope());
    const index = raw.indexOf("Child A1");
    const bytes = Buffer.concat([
      Buffer.from(raw.slice(0, index)),
      Buffer.from([0xc0, 0xaf]),
      Buffer.from(raw.slice(index + 1)),
    ]);
    expect(() => JSON.parse(new TextDecoder().decode(bytes))).not.toThrow();
    expect(() => decodeShareUrl(prefix + encodeBytes(bytes))).toThrow();
  });

  it("rejects invalid UTF-8 and compressed data before use", () => {
    for (const bytes of [
      new Uint8Array([0xc0, 0xaf]),
      new Uint8Array([0xed, 0xa0, 0x80]),
      new Uint8Array([0x1f, 0x8b, 0x08, 0]),
    ]) {
      expect(() => decodeShareUrl(prefix + encodeBytes(bytes))).toThrow();
    }
    expect(() => decodeShareUrl(encodeRaw('{"version":1,"bill":'))).toThrow();
    expect(() =>
      decodeShareUrl(encodeRaw(JSON.stringify(envelope()) + "garbage")),
    ).toThrow();
  });

  it.each([
    null,
    [],
    "bill",
    1,
    true,
    {},
    { version: 2, bill: exampleBill() },
    { version: "1", bill: exampleBill() },
    { version: 1 },
    { bill: exampleBill() },
    { version: 1, bill: exampleBill(), redirect: "https://other.example" },
  ])("rejects invalid envelopes without a legacy fallback %#", (value) => {
    expect(() => decodeShareUrl(encodeValue(value))).toThrow();
  });

  it.each(["title", "amount", "tone", "households"])(
    "rejects missing required shared bill field %s",
    (key) => {
      const bill: Record<string, unknown> = { ...exampleBill() };
      delete bill[key];
      expect(() => decodeShareUrl(encodeValue(envelope(bill)))).toThrow();
    },
  );

  it.each([null, [], "family", 1])(
    "rejects malformed nested household or child %#",
    (value) => {
      const bill = exampleBill();
      const badHouseholds = { ...bill, households: [value] };
      expect(() =>
        decodeShareUrl(encodeValue(envelope(badHouseholds))),
      ).toThrow();
      const badChildren = {
        ...bill,
        households: [{ ...bill.households[0], children: [value] }],
      };
      expect(() =>
        decodeShareUrl(encodeValue(envelope(badChildren))),
      ).toThrow();
    },
  );

  it.each(["__proto__", "prototype", "constructor", "redirect"])(
    "rejects unexpected object key %s without changing prototypes",
    (key) => {
      const value = { version: 1, bill: exampleBill() };
      for (const target of [
        value,
        value.bill,
        value.bill.households[0],
        value.bill.households[0].children[0],
      ]) {
        Object.defineProperty(target, key, {
          value: { polluted: true },
          enumerable: true,
          configurable: true,
        });
        expect(() => decodeShareUrl(encodeValue(value))).toThrow();
        delete (target as unknown as Record<string, unknown>)[key];
      }
      expect(Object.prototype).not.toHaveProperty("polluted");
      const bill = exampleBill();
      bill.households[0].children[0].name = key;
      expect(roundTrip(bill).households[0].children[0].name).toBe(key);
    },
  );

  it("requires own properties instead of accepting inherited fields", () => {
    expect(() =>
      record(Object.create({ title: "Dinner bill" }), ["title"]),
    ).toThrow();
    expect(() => readBill(Object.create(exampleBill()))).toThrow();
  });

  it.each([
    ["tone", "loud"],
    ["amount", 100],
    ["households", {}],
    ["title", null],
  ])("rejects invalid bill field %s", (key, value) => {
    expect(() =>
      decodeShareUrl(encodeValue(envelope({ ...exampleBill(), [key]: value }))),
    ).toThrow();
  });

  it.each([-1, 1.5, 1001, "1", null, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid adult count %#",
    (adults) => {
      const bill = exampleBill();
      expect(() =>
        decodeShareUrl(
          encodeValue(
            envelope({
              ...bill,
              households: [{ ...bill.households[0], adults }],
            }),
          ),
        ),
      ).toThrow();
    },
  );
  it.each([-1, 18, 1.5, "4", false])("rejects invalid child age %#", (age) => {
    const bill = exampleBill();
    expect(() =>
      decodeShareUrl(
        encodeValue(
          envelope({
            ...bill,
            households: [
              {
                ...bill.households[0],
                children: [{ ...bill.households[0].children[0], age }],
              },
            ],
          }),
        ),
      ),
    ).toThrow();
  });
  it.each([-5, 1, 101, 5.5, "25", null])(
    "rejects invalid child percentage %#",
    (percentage) => {
      const bill = exampleBill();
      expect(() =>
        decodeShareUrl(
          encodeValue(
            envelope({
              ...bill,
              households: [
                {
                  ...bill.households[0],
                  children: [{ ...bill.households[0].children[0], percentage }],
                },
              ],
            }),
          ),
        ),
      ).toThrow();
    },
  );
  it.each(["false", 0, null])(
    "rejects a nonboolean override %#",
    (overridden) => {
      const bill = exampleBill();
      expect(() =>
        decodeShareUrl(
          encodeValue(
            envelope({
              ...bill,
              households: [
                {
                  ...bill.households[0],
                  children: [{ ...bill.households[0].children[0], overridden }],
                },
              ],
            }),
          ),
        ),
      ).toThrow();
    },
  );

  it("accepts safe numeric JSON exponents by value without coercing strings", () => {
    const bill = exampleBill();
    const raw = JSON.stringify(envelope(bill)).replace(
      '"adults":1',
      '"adults":1e2',
    );
    expect(decodeShareUrl(encodeRaw(raw))!.bill.households[0].adults).toBe(100);
  });

  it.each(["", "../x", "h?x", "h#x", "h x", "h".repeat(81)])(
    "rejects unsafe or unbounded shared IDs %s",
    (id) => {
      const bill = exampleBill();
      bill.households[0].id = id;
      expect(() => decodeShareUrl(encodeValue(envelope(bill)))).toThrow();
    },
  );
  it("rejects IDs duplicated across households and children", () => {
    const bill = exampleBill();
    bill.households[1].id = bill.households[0].children[0].id;
    expect(() => decodeShareUrl(encodeValue(envelope(bill)))).toThrow();
  });
});

describe("Unicode and resource bounds", () => {
  it.each([
    "\0",
    "\n",
    "\r",
    "\t",
    "\u007f",
    "\u0085",
    "\u2028",
    "\u2029",
    "\u202a",
    "\u202e",
    "\u2066",
    "\u2069",
    "\ud800",
    "\udfff",
  ])("rejects actual control, bidi, or ill-formed Unicode %#", (character) => {
    expect(isSafeText(`Child A1${character}`)).toBe(false);
    const bill = exampleBill();
    bill.households[0].children[0].name = `Child A1${character}`;
    expect(() => decodeShareUrl(encodeValue(envelope(bill)))).toThrow();
  });

  it("counts Unicode code points rather than UTF-16 units and preserves normal text", () => {
    expect(isSafeText("🍽".repeat(120))).toBe(true);
    expect(isSafeText("🍽".repeat(121))).toBe(false);
    const bill = exampleBill();
    bill.title = "🍽".repeat(120);
    bill.households[0].name = "字 é e\u0301 Ω ' - 🍽️";
    const received = roundTrip(bill);
    expect(received.title).toBe(bill.title);
    expect(received.households[0].name).toBe(bill.households[0].name);
  });

  it("rejects oversized sharing fields without imposing the same name limit on drafts", () => {
    const bill = exampleBill();
    bill.households[0].name = "A".repeat(121);
    expect(() => readBill(bill, true)).toThrow();
    expect(readBill(bill).households[0].name).toHaveLength(121);
    bill.households[0].name = "Family A";
    bill.households[0].children[0].name = "C".repeat(121);
    expect(() => readBill(bill, true)).toThrow();
    bill.households[0].children[0].name = "Child A1";
    bill.title = "T".repeat(121);
    expect(() => readBill(bill)).toThrow();
  });

  it("enforces the 200-entity sharing limit as households plus children", () => {
    const bill = exampleBill();
    bill.households = [
      {
        id: "h0",
        name: "Family A",
        adults: 1,
        children: Array.from({ length: MAX_SHARE_ENTITIES - 1 }, (_, i) => ({
          id: `c${i}`,
          name: "",
          age: null,
          percentage: 0,
          overridden: false,
        })),
      },
    ];
    expect(readBill(bill, true).households[0].children).toHaveLength(199);
    bill.households[0].children.push({
      id: "c199",
      name: "",
      age: null,
      percentage: 0,
      overridden: false,
    });
    expect(() => readBill(bill, true)).toThrow("too large");
    expect(readBill(bill).households[0].children).toHaveLength(200);
  });

  it("allows a complete URL at the exact bound and rejects either direction above it", () => {
    const bill = exampleBill();
    const short = createShareUrl(bill, "entered", origin, "/");
    const targetPathLength = MAX_SHARE_URL - short.length + 1;
    const exactPath = `/${"p".repeat(targetPathLength - 2)}/`;
    const exact = createShareUrl(bill, "entered", origin, exactPath);
    expect(exact).toHaveLength(MAX_SHARE_URL);
    expect(decodeShareUrl(exact)!.bill.amount).toBe("254.74");
    expect(() =>
      createShareUrl(bill, "entered", origin, `${exactPath}p/`),
    ).toThrow("too large");
    const tooLong = new URL(exact);
    tooLong.search = "?x";
    expect(() => decodeShareUrl(tooLong.href)).toThrow("too large");
  });

  it("limits UTF-8 bytes before parsing and accepts the exact decoded ceiling", () => {
    expect(
      boundedJson(" ".repeat(MAX_SHARE_BYTES - 2) + "{}", MAX_SHARE_BYTES),
    ).toEqual({});
    expect(() =>
      boundedJson(" ".repeat(MAX_SHARE_BYTES - 1) + "{}", MAX_SHARE_BYTES),
    ).toThrow("too large");
    const unicode = JSON.stringify("🍽".repeat(10));
    expect(() => boundedJson(unicode, unicode.length)).toThrow("too large");
  });

  it("rejects excess nesting while ignoring escaped and quoted brackets", () => {
    expect(boundedJson("[".repeat(8) + "]".repeat(8))).toBeDefined();
    expect(() => boundedJson("[".repeat(9) + "]".repeat(9))).toThrow("nesting");
    const text = String.raw`[[[[[[[[[[[[ " \\ ]]]]]]]]]]]]]`;
    expect(boundedJson(JSON.stringify({ text }))).toEqual({ text });
    expect(() =>
      decodeShareUrl(encodeRaw("[".repeat(9) + "]".repeat(9))),
    ).toThrow();
  });
});

describe("local-draft migration and title behavior", () => {
  it("migrates a legacy draft without changing its data or requiring a share-valid amount", () => {
    const bill = exampleBill();
    bill.amount = "temporarily invalid";
    const legacy: Record<string, unknown> = { ...bill };
    delete legacy.title;
    const restored = parseDraft(JSON.stringify(legacy));
    expect(restored).toEqual({ ...bill, title: DEFAULT_TITLE });
    expect(serializeDraft(restored)).toContain("temporarily invalid");
    expect(canShare(restored)).toBe(false);
    expect(() => decodeShareUrl(encodeValue(envelope(legacy)))).toThrow();
  });

  it("keeps title text in both message tones and uses the default for blank display", () => {
    const bill = exampleBill();
    bill.title = "  Family A–D dinner  ";
    expect(billTitle(bill)).toBe("Family A–D dinner");
    for (const tone of ["fun", "simple"] as const) {
      bill.tone = tone;
      expect(generateMessage(bill, allocate(25474, bill.households))).toContain(
        "Family A–D dinner",
      );
    }
    bill.title = "   ";
    expect(billTitle(bill)).toBe(DEFAULT_TITLE);
    expect(cleanBill().title).toBe(DEFAULT_TITLE);
  });

  it.each([
    "not-json",
    "null",
    "[]",
    "{}",
    '{"title":"Dinner bill"}',
    JSON.stringify({ ...exampleBill(), households: [null] }),
  ])(
    "rejects a corrupt local draft without mutating its raw input %#",
    (raw) => {
      const original = raw;
      expect(() => parseDraft(raw)).toThrow();
      expect(raw).toBe(original);
    },
  );

  it("enforces the per-slot 1 MiB persistence bound separately from sharing limits", () => {
    expect(() => parseDraft(" ".repeat(MAX_DRAFT_BYTES) + "{}")).toThrow(
      "too large",
    );
    const bill = exampleBill();
    bill.households[0].name = "A".repeat(MAX_DRAFT_BYTES);
    expect(() => serializeDraft(bill)).toThrow("too large");
  });

  it("derives a bounded, stable matcher without exposing the snapshot contents", async () => {
    const hash = new URL(
      createShareUrl(exampleBill(), "entered", origin, basePath),
    ).hash;
    const digest = await snapshotDigest(hash);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await snapshotDigest(hash)).toBe(digest);
    expect(await snapshotDigest(`${hash}A`)).not.toBe(digest);
    await expect(
      snapshotDigest("x".repeat(MAX_SHARE_URL + 1)),
    ).rejects.toThrow();
  });
});
