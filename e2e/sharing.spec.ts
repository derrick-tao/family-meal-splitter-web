import { test, expect, type Page } from "@playwright/test";
import { cleanBill, exampleBill, STORAGE_KEY } from "../lib/meal";
import { createShareUrl, snapshotDigest } from "../lib/sharing";
import {
  newSession,
  SESSION_STORAGE_KEY,
  SHARED_STORAGE_KEY,
} from "../lib/sessions";
import { TAB_BILL_KEY } from "../lib/tab-bill";

const originals = ["$62.67", "$40.44", "$90.98", "$60.65"];
const revisions = ["$68.58", "$39.19", "$88.18", "$58.79"];
const title = (page: Page) => page.getByLabel("Dinner title", { exact: true });
async function fillTitle(page: Page, value: string) {
  const reveal = page.getByRole("button", {
    name: "Add a dinner name",
    exact: true,
  });
  if (await reveal.isVisible()) await reveal.click();
  await title(page).fill(value);
}
function snapshot(bill = exampleBill()) {
  const base = new URL(test.info().project.use.baseURL as string);
  return createShareUrl(bill, "entered", base.origin, base.pathname);
}
async function payments(page: Page, values = originals) {
  for (const [i, value] of values.entries())
    await expect(page.getByTestId(`payment-${i}`)).toHaveText(value);
}
async function raw(page: Page) {
  return page.evaluate((key) => sessionStorage.getItem(key), TAB_BILL_KEY);
}
async function accept(
  page: Page,
  action: "Replace bill" | "Start new bill" | "Load example",
) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: action, exact: true })
    .click();
}
async function share(page: Page, entered = true) {
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Use children’s initials" }),
  ).toBeChecked();
  await expect(page.getByRole("dialog")).toContainText(
    "Share again after editing",
  );
  if (entered)
    await page.getByRole("radio", { name: "Keep names as entered" }).check();
  await page
    .getByRole("button", { name: "Copy share link", exact: true })
    .click();
  const url = await page
    .getByRole("textbox", { name: "Share link", exact: true })
    .inputValue();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(url);
  expect(new URL(url).search).toBe("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  return url;
}

test("snapshots stay immutable while a plain-address copy edits, refreshes, and shares revisions", async ({
  page,
  browser,
}) => {
  const original = snapshot();
  await page.goto(original);
  await payments(page);
  for (const input of await page.locator(".editor input, .editor button").all())
    await expect(input).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Try an example|Load Example Dinner/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Reset changes|Reset saved dinner/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("");
  const working = page.url();
  const slider = page.getByLabel("Portion for Child A2", { exact: true });
  await slider.fill("50");
  await payments(page, revisions);
  await page.reload();
  await expect(slider).toHaveValue("50");
  const revised = await share(page);
  expect(revised).not.toBe(original);
  expect(page.url()).toBe(working);
  await page.getByRole("button", { name: "Copy Message" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await page.getByTestId("message").innerText(),
  );
  await page.goBack();
  await expect(slider).toBeDisabled();
  await payments(page);
  await page
    .getByRole("button", { name: "Continue my bill", exact: true })
    .click();
  await expect(slider).toHaveValue("50");
  const recipient = await browser.newContext();
  const other = await recipient.newPage();
  await other.goto(revised);
  await payments(other, revisions);
  await expect(title(other)).toBeDisabled();
  await other.goto(original);
  await payments(other);
  await recipient.close();
});

test("independent no-opener tabs in the same browser context never share editable work", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await fillTitle(page, "Family A bill");
  const first = await raw(page);
  const other = await context.newPage();
  await other.goto("./");
  await expect(title(other)).toHaveValue("Dinner bill");
  expect(await raw(other)).toBeNull();
  await fillTitle(other, "Family B bill");
  await other.reload();
  await expect(title(other)).toHaveValue("Family B bill");
  await page.reload();
  await expect(title(page)).toHaveValue("Family A bill");
  expect(await raw(page)).toBe(first);
  await other.getByRole("button", { name: "New bill", exact: true }).click();
  await accept(other, "Start new bill");
  await expect(title(other)).toHaveValue("Dinner bill");
  await page.reload();
  await expect(title(page)).toHaveValue("Family A bill");
  await other.close();
});

test("opener-created tabs inherit an initial copy then edit and replace independently", async ({
  page,
}) => {
  await page.goto("./");
  await fillTitle(page, "Family A bill");
  const pending = page.waitForEvent("popup");
  await page.evaluate((url) => {
    window.open(url, "_blank");
  }, page.url());
  const other = await pending;
  await expect(title(other)).toHaveValue("Family A bill");
  await fillTitle(other, "Family B bill");
  await other.reload();
  await expect(title(other)).toHaveValue("Family B bill");
  await page.reload();
  await expect(title(page)).toHaveValue("Family A bill");
  await page.getByRole("button", { name: "New bill", exact: true }).click();
  await accept(page, "Start new bill");
  await other.reload();
  await expect(title(other)).toHaveValue("Family B bill");
  await other.close();
});

test("viewing a shared bill preserves current work; copy and New bill cancellations preserve bytes", async ({
  page,
}) => {
  await page.goto("./");
  await fillTitle(page, "Family B bill");
  const stored = await raw(page);
  const url = snapshot();
  await page.goto(url);
  await payments(page);
  expect(await raw(page)).toBe(stored);
  for (const action of ["Make a copy", "New bill"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Keep its share link first",
    );
    await page
      .getByRole("button", { name: "Keep my bill", exact: true })
      .click();
    expect(page.url()).toBe(url);
    expect(await raw(page)).toBe(stored);
    await payments(page);
  }
  await page
    .getByRole("button", { name: "Continue my bill", exact: true })
    .click();
  await expect(title(page)).toHaveValue("Family B bill");
  await page.goBack();
  await payments(page);
  await page.goForward();
  await expect(title(page)).toHaveValue("Family B bill");
  await page.goto(url);
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  await accept(page, "Replace bill");
  await payments(page);
  await expect(title(page)).toBeEnabled();
  await page.getByRole("button", { name: "New bill", exact: true }).click();
  await accept(page, "Start new bill");
  await expect(
    page.getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ }),
  ).toHaveValue("0.00");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New bill", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("privacy keeps ages, initials default anew, dialog keyboard works and fallback is usable on 320px", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  const url = await share(page, false);
  await page.goto(url);
  await expect(page.getByLabel("Child 1 name in Family A")).toHaveValue(
    "C. A.",
  );
  await expect(
    page.getByLabel("Age of C. A.", { exact: true }).first(),
  ).toHaveValue("4");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Use children’s initials" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Copy share link", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("radio", { name: "Use children’s initials" }),
  ).toBeFocused();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page
    .getByRole("button", { name: "Copy share link", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "copy it manually",
  );
  await expect(
    page.getByRole("textbox", { name: "Share link", exact: true }),
  ).not.toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeFocused();
});

test("legacy browser and tab bills recover explicitly into the new key without changing old bytes", async ({
  page,
}) => {
  await page.goto("./");
  const earlier = exampleBill();
  earlier.title = "Family A earlier bill";
  const oldTab = newSession(earlier);
  oldTab.current.title = "Family B earlier bill";
  const values = {
    browser: JSON.stringify(earlier),
    tab: JSON.stringify(oldTab),
  };
  await page.evaluate(
    ({ values, ordinary, tab }) => {
      localStorage.setItem(ordinary, values.browser);
      sessionStorage.setItem(tab, values.tab);
    },
    { values, ordinary: STORAGE_KEY, tab: SESSION_STORAGE_KEY },
  );
  await page.reload();
  await expect(title(page)).toHaveValue("Dinner bill");
  expect(await raw(page)).toBeNull();
  await page.getByText("Recover an earlier bill", { exact: true }).click();
  await page
    .getByRole("button", { name: "Recover earlier browser bill", exact: true })
    .click();
  await expect(title(page)).toHaveValue(earlier.title);
  await page
    .getByRole("button", { name: "Recover earlier tab bill", exact: true })
    .click();
  await accept(page, "Replace bill");
  await expect(title(page)).toHaveValue(oldTab.current.title);
  expect(
    await page.evaluate(
      ({ ordinary, tab }) => [
        localStorage.getItem(ordinary),
        sessionStorage.getItem(tab),
      ],
      { ordinary: STORAGE_KEY, tab: SESSION_STORAGE_KEY },
    ),
  ).toEqual([values.browser, values.tab]);
});

test("matching legacy shared edits recover explicitly and never override the original", async ({
  page,
}) => {
  const url = snapshot(),
    prior = exampleBill();
  prior.households[0].children[1].percentage = 50;
  prior.households[0].children[1].overridden = true;
  const stored = JSON.stringify({
    snapshot: await snapshotDigest(new URL(url).hash),
    bill: prior,
  });
  await page.goto("./");
  await page.evaluate(({ key, stored }) => localStorage.setItem(key, stored), {
    key: SHARED_STORAGE_KEY,
    stored,
  });
  await page.goto(url);
  await payments(page);
  await page.getByText("Recover an earlier bill", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Recover earlier edits to this link",
      exact: true,
    })
    .click();
  await payments(page, revisions);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SHARED_STORAGE_KEY),
  ).toBe(stored);
  await page.goto(url);
  await payments(page);
});

test("delayed legacy digest cannot unlock snapshots or publish stale views after navigation", async ({
  page,
}) => {
  const url = snapshot();
  const earlier = JSON.stringify({
    snapshot: await snapshotDigest(new URL(url).hash),
    bill: exampleBill(),
  });
  await page.goto("./");
  await fillTitle(page, "Family B current bill");
  const stored = await raw(page),
    base = page.url();
  await page.evaluate(
    ({ key, earlier }) => {
      localStorage.setItem(key, earlier);
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      const pending: Array<() => Promise<void>> = [];
      Object.defineProperty(crypto.subtle, "digest", {
        configurable: true,
        value: (algorithm: AlgorithmIdentifier, data: BufferSource) =>
          new Promise<ArrayBuffer>((resolve, reject) => {
            pending.push(async () => {
              try {
                resolve(await digest(algorithm, data));
              } catch (error) {
                reject(error);
              }
            });
          }),
      });
      Object.defineProperty(window, "pendingDigestCount", {
        get: () => pending.length,
      });
      Object.defineProperty(window, "flushDigests", {
        value: async () => {
          await Promise.all(pending.splice(0).map((job) => job()));
        },
      });
    },
    { key: SHARED_STORAGE_KEY, earlier },
  );
  await page.evaluate((hash) => {
    location.hash = hash;
  }, new URL(url).hash);
  await expect.poll(() => page.evaluate("window.pendingDigestCount")).toBe(1);
  await expect(title(page)).toHaveValue("Dinner bill");
  for (const control of await page
    .locator(".editor input, .editor button")
    .all())
    await expect(control).toBeDisabled();
  await payments(page);
  expect(await raw(page)).toBe(stored);
  await page.goBack();
  await expect(title(page)).toHaveValue("Family B current bill");
  await expect(title(page)).toBeEnabled();
  expect(page.url()).toBe(base);
  await page.evaluate("window.flushDigests()");
  await expect(title(page)).toHaveValue("Family B current bill");
  await expect(title(page)).toBeEnabled();
  expect(await raw(page)).toBe(stored);
  await page.goForward();
  await expect.poll(() => page.evaluate("window.pendingDigestCount")).toBe(1);
  await payments(page);
  await expect(title(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Continue my bill", exact: true })
    .click();
  await page.evaluate("window.flushDigests()");
  await expect(title(page)).toHaveValue("Family B current bill");
  await expect(title(page)).toBeEnabled();
  await page.goBack();
  await expect.poll(() => page.evaluate("window.pendingDigestCount")).toBe(1);
  await payments(page);
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  await accept(page, "Replace bill");
  await fillTitle(page, "Family C copied bill");
  const copied = await raw(page);
  await page.evaluate("window.flushDigests()");
  expect(page.url()).toBe(base);
  await expect(title(page)).toHaveValue("Family C copied bill");
  await expect(title(page)).toBeEnabled();
  expect(await raw(page)).toBe(copied);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SHARED_STORAGE_KEY),
  ).toBe(earlier);
});

test("old pointers only recover a matching validated record and reject ambiguous addresses", async ({
  page,
}) => {
  const old = newSession(exampleBill());
  const stored = JSON.stringify(old);
  await page.goto("./");
  await page.evaluate(
    ({ key, stored }) => sessionStorage.setItem(key, stored),
    { key: SESSION_STORAGE_KEY, stored },
  );
  const base = new URL(page.url());
  for (const suffix of [
    "?draft=bad",
    "?draft=" + crypto.randomUUID(),
    "?draft=" + old.id + "&draft=" + old.id,
    "?draft=" + old.id + new URL(snapshot()).hash,
  ]) {
    await page.goto(base.href + suffix);
    await expect(page.locator("main [role=alert]")).toBeVisible();
    await expect(page.locator(".workspace")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Recover earlier tab bill",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        (key) => sessionStorage.getItem(key),
        SESSION_STORAGE_KEY,
      ),
    ).toBe(stored);
    expect(await raw(page)).toBeNull();
  }
  await page.goto(base.href + "?draft=" + old.id);
  await page.getByText("Recover an earlier bill", { exact: true }).click();
  await page
    .getByRole("button", { name: "Recover earlier tab bill", exact: true })
    .click();
  await payments(page);
  expect(new URL(page.url()).search).toBe("");
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      SESSION_STORAGE_KEY,
    ),
  ).toBe(stored);
});

test("corrupt active records are preserved until explicit replacement; invalid snapshots cannot overwrite", async ({
  page,
}) => {
  const stored = "{unreadable bill";
  await page.goto("./");
  await page.evaluate(
    ({ key, stored }) => sessionStorage.setItem(key, stored),
    { key: TAB_BILL_KEY, stored },
  );
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "previous bill" }),
  ).toContainText("stored data is preserved");
  await fillTitle(page, "Family A memory");
  expect(await raw(page)).toBe(stored);
  const url = snapshot();
  await page.evaluate((hash) => {
    location.hash = hash;
  }, new URL(url).hash);
  await payments(page);
  for (const action of ["Make a copy", "New bill"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("could not be read");
    await page
      .getByRole("button", { name: "Keep my bill", exact: true })
      .click();
    expect(await raw(page)).toBe(stored);
    expect(page.url()).toBe(url);
  }
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  await accept(page, "Replace bill");
  await payments(page);
  expect(await raw(page)).not.toBe(stored);
  const valid = await raw(page);
  const bad = new URL(page.url());
  bad.hash = "#share=v1.bad%bad";
  await page.goto(bad.href);
  await expect(page.locator("main [role=alert]")).toContainText(
    "saved dinners are unchanged",
  );
  expect(await raw(page)).toBe(valid);
});

test("failed writes preserve saved bytes and unsaved memory through snapshot and Continue navigation", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  const stored = await raw(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === sessionStorage && k === key) throw new Error("quota");
      return original.call(this, k, v);
    };
    Object.defineProperty(window, "restoreWrites", {
      value: () => {
        Storage.prototype.setItem = original;
      },
    });
  }, TAB_BILL_KEY);
  await fillTitle(page, "Family A in memory");
  await expect(
    page.getByRole("status").filter({ hasText: "not saved" }),
  ).toContainText("use Share");
  expect(await raw(page)).toBe(stored);
  await page.evaluate((hash) => {
    location.hash = hash;
  }, new URL(snapshot()).hash);
  await payments(page);
  await expect(title(page)).toHaveValue("Dinner bill");
  await page
    .getByRole("button", { name: "Continue my bill", exact: true })
    .click();
  await expect(title(page)).toHaveValue("Family A in memory");
  expect(await raw(page)).toBe(stored);
  const revised = await share(page);
  expect(revised).toContain("#share=v1.");
  await page.evaluate("window.restoreWrites()");
  await fillTitle(page, "Family A saved again");
  await expect(
    page.getByText("Saved in this tab", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(title(page)).toHaveValue("Family A saved again");
});

test("unavailable storage permits in-memory editing and sharing with accurate status", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem,
      set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (this === sessionStorage) throw new Error("unavailable");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage) throw new Error("unavailable");
      return set.call(this, key, value);
    };
  });
  await page.goto(snapshot());
  await payments(page);
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("could not be read");
  await accept(page, "Replace bill");
  await fillTitle(page, "Family A in memory");
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  const url = await share(page);
  expect(url).toContain("#share=v1.");
});

test("failed app navigation preserves display, current memory, URL, and stored bytes", async ({
  page,
}) => {
  await page.goto("./");
  await fillTitle(page, "Family B original work");
  const stored = await raw(page);
  const url = snapshot();
  await page.evaluate((hash) => {
    location.hash = hash;
  }, new URL(url).hash);
  await payments(page);
  await page.evaluate(() => {
    history.pushState = () => {
      throw new Error("history unavailable");
    };
  });
  for (const [action, button] of [
    ["Make a copy", "Replace bill"],
    ["New bill", "Start new bill"],
  ] as const) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await accept(page, button);
    await expect(
      page.getByRole("status").filter({ hasText: "action could not" }),
    ).toContainText("unchanged");
    expect(page.url()).toBe(url);
    expect(await raw(page)).toBe(stored);
    await expect(title(page)).toHaveValue("Dinner bill");
    await payments(page);
  }
  await page
    .getByRole("button", { name: "Continue my bill", exact: true })
    .click();
  expect(page.url()).toBe(url);
  expect(await raw(page)).toBe(stored);
  await page.goBack();
  await expect(title(page)).toHaveValue("Family B original work");
});

test("hostile names remain literal with no attacker execution or external requests", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string),
    bill = exampleBill();
  bill.title = "Family A <img src=x onerror=alert(1)> & ? # %";
  bill.households[0].name = "Family A javascript:alert(1)";
  bill.households[0].children[0].name = "Child A1 <svg onload=alert(1)>";
  const errors: string[] = [],
    external: string[] = [];
  let dialogs = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== base.origin) external.push(r.url());
  });
  await page.goto(snapshot(bill));
  await expect(title(page)).toHaveValue(bill.title);
  await expect(page.locator("#split-heading")).toHaveText(bill.title);
  await expect(page.locator('img[src="x"],svg[onload]')).toHaveCount(0);
  expect(dialogs).toBe(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.getByRole("button", { name: "Make a copy", exact: true }).click();
  const url = await share(page);
  await page.goto(url);
  await expect(title(page)).toHaveValue(bill.title);
});

test("single-line controls cannot enter names or copied messages", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  const input = page.getByLabel("Child 1 name in Family A");
  await input.fill("Child A1\u202e");
  await expect(input).toHaveValue("Child A1");
  await fillTitle(page, "Family A dinner\u2066");
  await expect(title(page)).toHaveValue("Dinner bill");
  await page.getByRole("button", { name: "Copy Message" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/u);
  expect(copied).toBe(await page.getByTestId("message").innerText());
});

test("example replacement and tiny changes are protected; incomplete amount survives refresh", async ({
  page,
}) => {
  await page.goto("./");
  await fillTitle(page, "Family A bill");
  const stored = await raw(page);
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  await page.getByRole("button", { name: "Keep my bill", exact: true }).click();
  expect(await raw(page)).toBe(stored);
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  await accept(page, "Load example");
  await payments(page);
  await page
    .getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ })
    .fill("incomplete");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ }),
  ).toHaveValue("incomplete");
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "New bill", exact: true }).click();
  await accept(page, "Start new bill");
  expect(JSON.parse((await raw(page))!)).toEqual({
    version: 2,
    bill: cleanBill(),
  });
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await payments(page);
});
