import { test, expect, type Page } from "@playwright/test";
import { exampleBill, STORAGE_KEY } from "../lib/meal";
import { createShareUrl, snapshotDigest } from "../lib/sharing";
import { SESSION_STORAGE_KEY, newSession } from "../lib/sessions";
const sharedKey = "family-meal-splitter-shared-v1";
async function share(page: Page, entered = false) {
  await page
    .getByRole("button", { name: /^(Share dinner|Share changes)$/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Ages stay included in both options.",
  );
  if (entered)
    await page.getByRole("radio", { name: "Keep names as entered" }).check();
  else
    await expect(
      page.getByRole("radio", { name: "Use children’s initials" }),
    ).toBeChecked();
  await page
    .getByRole("button", { name: "Copy share link", exact: true })
    .click();
  const url = await page
    .getByRole("textbox", { name: "Share link", exact: true })
    .inputValue();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(url);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  return url;
}
test("original snapshots stay read-only while independent local copies reset and share revisions", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Load Example Dinner" }).click();
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A dinner");
  const fullUrl = await share(page, true);
  const recipient = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const other = await recipient.newPage();
  await other.goto("./");
  await other
    .getByLabel("Dinner title", { exact: true })
    .fill("Family B dinner");
  await expect
    .poll(() => other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
    .toContain("Family B dinner");
  const ordinary = await other.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  await other.goto(fullUrl);
  await expect(other.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A dinner",
  );
  for (const control of await other
    .locator(".editor input, .editor button")
    .all())
    await expect(control).toBeDisabled();
  await expect(
    other.getByRole("button", { name: "Load Example Dinner" }),
  ).toHaveCount(0);
  await expect(
    other.getByRole("button", { name: "✨ Simple", exact: true }),
  ).toBeDisabled();
  await expect(
    other.getByRole("button", { name: "Reset changes", exact: true }),
  ).toHaveCount(0);
  for (const [i, value] of ["$62.67", "$40.44", "$90.98", "$60.65"].entries())
    await expect(other.getByTestId(`payment-${i}`)).toHaveText(value);
  await other.getByRole("button", { name: "Edit a copy", exact: true }).click();
  const draftUrl = other.url();
  expect(new URL(draftUrl).search).toMatch(/^\?draft=[0-9a-f-]{36}$/);
  expect(new URL(draftUrl).hash).toBe("");
  const slider = other.getByLabel("Portion for Child A2", { exact: true });
  await slider.fill("50");
  for (const [i, value] of ["$68.58", "$39.19", "$88.18", "$58.79"].entries())
    await expect(other.getByTestId(`payment-${i}`)).toHaveText(value);
  await other.reload();
  await expect(slider).toHaveValue("50");
  const revised = await share(other, true);
  expect(revised).not.toBe(fullUrl);
  expect(new URL(revised).search).toBe("");
  expect(other.url()).toBe(draftUrl);
  await other
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Keep my dinner", exact: true })
    .click();
  await expect(slider).toHaveValue("50");
  await other
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await other
    .getByRole("dialog")
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await expect(slider).toHaveValue("30");
  expect(other.url()).toBe(draftUrl);
  await other.getByRole("link", { name: "family meal splitter" }).click();
  expect(other.url()).toBe(draftUrl);
  await other
    .getByRole("button", { name: "View original snapshot", exact: true })
    .click();
  await expect(
    other.getByLabel("Dinner title", { exact: true }),
  ).toBeDisabled();
  expect(other.url()).toBe(fullUrl);
  await other.goBack();
  await expect(slider).toHaveValue("30");
  await other.goForward();
  await expect(slider).toBeDisabled();
  await other
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  await expect(other.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family B dinner",
  );
  expect(
    await other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(ordinary);
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(draftUrl);
  await expect(freshPage.locator("main [role=alert]")).toContainText(
    "This local copy is not available in this tab",
  );
  await freshPage.goto(revised);
  await expect(freshPage.getByTestId("payment-0")).toHaveText("$68.58");
  await freshPage.goto(fullUrl);
  await expect(freshPage.getByTestId("payment-0")).toHaveText("$62.67");
  await recipient.close();
  await fresh.close();
});
test("initials retain ages, dialog resets privacy, and clipboard failure exposes a manual link", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Load Example Dinner" }).click();
  const url = await share(page);
  await expect(page.getByLabel("Child 1 name in Family A")).toHaveValue(
    "Child A1",
  );
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(url);
  await expect(other.getByLabel("Child 1 name in Family A")).toHaveValue(
    "C. A.",
  );
  await expect(
    other.getByLabel("Age of C. A.", { exact: true }).first(),
  ).toHaveValue("4");
  await page.getByRole("button", { name: "Share dinner", exact: true }).click();
  await page.getByRole("radio", { name: "Keep names as entered" }).check();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Share dinner", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Use children’s initials" }),
  ).toBeChecked();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page
    .getByRole("button", { name: "Copy share link", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Copy unavailable" }),
  ).toContainText("copy it manually");
  await expect(
    page.getByRole("textbox", { name: "Share link", exact: true }),
  ).not.toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share dinner", exact: true }),
  ).toBeFocused();
  await otherContext.close();
});
test("malformed links and corrupt storage never overwrite saved bytes", async ({
  page,
}) => {
  await page.goto("./");
  const values = {
    ordinary: '{"invalid":"keep ordinary"}',
    shared: '{"invalid":"keep shared"}',
    other: "unrelated",
  };
  await page.evaluate(
    ({ key, sharedKey, values }) => {
      localStorage.setItem(key, values.ordinary);
      localStorage.setItem(sharedKey, values.shared);
      localStorage.setItem("unrelated", values.other);
    },
    { key: STORAGE_KEY, sharedKey, values },
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Existing data is preserved",
  );
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toHaveCount(0);
  const url = new URL(page.url());
  url.hash = "#share=v1.bad%bad";
  await page.goto(url.href);
  await expect(
    page.getByRole("alert").filter({ hasText: "This shared dinner link" }),
  ).toContainText("saved dinners are unchanged");
  await expect(page.locator(".workspace")).toHaveCount(0);
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      ({ key, sharedKey }) => [
        localStorage.getItem(key),
        localStorage.getItem(sharedKey),
        localStorage.getItem("unrelated"),
      ],
      { key: STORAGE_KEY, sharedKey },
    ),
  ).toEqual([values.ordinary, values.shared, values.other]);
});
test("hostile text stays inert under the exported CSP", async ({ page }) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const bill = exampleBill();
  bill.title = "<img src=x onerror=alert(1)> & ? # %";
  bill.households[0].name = "javascript:alert(1)";
  bill.households[0].children[0].name = "<svg onload=alert(1)>";
  const url = createShareUrl(bill, "entered", base.origin, base.pathname);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  const external: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== base.origin) external.push(r.url());
  });
  await page.goto(url);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    bill.title,
  );
  await expect(page.locator("#split-heading")).toHaveText(bill.title);
  await expect(page.locator('img[src="x"],svg[onload]')).toHaveCount(0);
  expect(dialogs).toBe(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Copy Message" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await page.getByTestId("message").innerText(),
  );
});

test("active edited sessions require replacement confirmation even from an original or ordinary dinner", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const link = createShareUrl(
    exampleBill(),
    "entered",
    base.origin,
    base.pathname,
  );
  await page.goto(link);
  await page.getByRole("button", { name: "Edit a copy", exact: true }).click();
  const firstUrl = page.url();
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A edited");
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), SESSION_STORAGE_KEY),
    )
    .toContain("Family A edited");
  await page
    .getByRole("button", { name: "View original snapshot", exact: true })
    .click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Start new dinner", exact: true })
    .click();
  expect(page.url()).toBe(link);
  await page
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Start new dinner", exact: true })
    .click();
  expect(new URL(page.url()).search).toBe("");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Start new dinner", exact: true })
    .click();
  expect(page.url()).not.toBe(firstUrl);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
  await expect(page.getByLabel("Total bill amount")).toHaveValue("0.00");
  await page.getByRole("button", { name: "Load Example Dinner" }).click();
  await expect(page.getByTestId("payment-0")).toHaveText("$62.67");
  await page
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await expect(page.getByLabel("Total bill amount")).toHaveValue("0.00");
  await expect(page.getByTestId("payment-0")).toHaveCount(0);
});
test("matching legacy edits recover explicitly with the original as reset baseline", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const link = createShareUrl(
    exampleBill(),
    "entered",
    base.origin,
    base.pathname,
  );
  const prior = exampleBill();
  prior.title = "Family A previous edits";
  const raw = JSON.stringify({
    snapshot: await snapshotDigest(new URL(link).hash),
    bill: prior,
  });
  await page.goto("./");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: sharedKey,
    raw,
  });
  await page.goto(link);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
  await page
    .getByRole("button", {
      name: "Recover previous edits as a local copy",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    prior.title,
  );
  await page
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset changes", exact: true })
    .click();
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), sharedKey),
  ).toBe(raw);
  await page
    .getByRole("button", { name: "View original snapshot", exact: true })
    .click();
  await page.evaluate(
    (key) => localStorage.setItem(key, "corrupt previous edits"),
    sharedKey,
  );
  await page.reload();
  await expect(page.getByTestId("payment-0")).toHaveText("$62.67");
  await expect(page.getByRole("status")).toContainText(
    "older stored data is preserved",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), sharedKey),
  ).toBe("corrupt previous edits");
});
test("invalid, mismatched and ambiguous local pointers preserve records without draft disclosure", async ({
  page,
}) => {
  const session = newSession(exampleBill());
  await page.goto("./");
  const raw = JSON.stringify(session);
  await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), {
    key: SESSION_STORAGE_KEY,
    raw,
  });
  const base = new URL(page.url());
  const different = newSession(exampleBill()).id;
  for (const query of [
    "?draft=" + different,
    "?draft=bad",
    "?draft=" + session.id + "&draft=" + session.id,
    "?draft=" + session.id + "#share=v1.bad",
  ]) {
    await page.goto(base.href + query);
    await expect(page.locator("main [role=alert]")).toBeVisible();
    await expect(page.getByTestId("payment-0")).toHaveCount(0);
    expect(
      await page.evaluate(
        (key) => sessionStorage.getItem(key),
        SESSION_STORAGE_KEY,
      ),
    ).toBe(raw);
  }
  for (const rejected of ["corrupt", "x".repeat(1048577)]) {
    await page.evaluate(
      ({ key, rejected }) => sessionStorage.setItem(key, rejected),
      { key: SESSION_STORAGE_KEY, rejected },
    );
    await page.goto(base.href + "?draft=" + session.id);
    await expect(page.locator("main [role=alert]")).toContainText(
      "This local copy is not available in this tab",
    );
    expect(
      await page.evaluate(
        (key) => sessionStorage.getItem(key),
        SESSION_STORAGE_KEY,
      ),
    ).toBe(rejected);
  }
});
test("failed session writes warn, guard navigation, and recover after storage works", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  await page.goto(
    createShareUrl(exampleBill(), "entered", base.origin, base.pathname),
  );
  await page.getByRole("button", { name: "Edit a copy", exact: true }).click();
  const link = page.url();
  await page.evaluate(() => {
    Object.defineProperty(window, "restoreStorageWrite", {
      value: Storage.prototype.setItem,
      configurable: true,
    });
    Storage.prototype.setItem = function () {
      throw new Error("quota");
    };
  });
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A unsaved");
  await expect(page.getByRole("status")).toContainText(
    "Changes cannot be saved",
  );
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  expect(page.url()).toBe(link);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A unsaved",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = (
      window as unknown as {
        restoreStorageWrite: typeof Storage.prototype.setItem;
      }
    ).restoreStorageWrite;
  });
  await page.getByLabel("Dinner title", { exact: true }).fill("Family A saved");
  await expect(
    page.getByRole("status").filter({ hasText: "Changes cannot be saved" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), SESSION_STORAGE_KEY),
    )
    .toContain("Family A saved");
  await page
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
});
test("single-line controls cannot enter names or copied messages", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Load Example Dinner" }).click();
  const input = page.getByLabel("Child 1 name in Family A");
  await input.fill("Child A1\u202e");
  await expect(input).toHaveValue("Child A1");
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A dinner\u2066");
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
  await page.getByRole("button", { name: "Copy Message" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/u);
  expect(copied).toBe(await page.getByTestId("message").innerText());
});

test("opener-created tabs can inherit initial local storage but then edit independently", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  await page.goto(
    createShareUrl(exampleBill(), "entered", base.origin, base.pathname),
  );
  await page.getByRole("button", { name: "Edit a copy", exact: true }).click();
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A original tab");
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), SESSION_STORAGE_KEY),
    )
    .toContain("Family A original tab");
  const popupPromise = page.waitForEvent("popup");
  await page.evaluate((url) => {
    window.open(url, "_blank");
  }, page.url());
  const popup = await popupPromise;
  await expect(popup.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A original tab",
  );
  await popup
    .getByLabel("Dinner title", { exact: true })
    .fill("Family B copied tab");
  await popup.reload();
  await expect(popup.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family B copied tab",
  );
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A original tab",
  );
  await page.reload();
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A original tab",
  );
  await popup.close();
});

test("unavailable session storage permits an honestly unsaved in-memory copy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem,
      originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (this === sessionStorage) throw new Error("unavailable");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage) throw new Error("unavailable");
      return originalSet.call(this, key, value);
    };
  });
  const base = new URL(test.info().project.use.baseURL as string);
  await page.goto(
    createShareUrl(exampleBill(), "entered", base.origin, base.pathname),
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Edit a copy", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Changes cannot be saved",
  );
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A in memory");
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "View original snapshot", exact: true })
    .click();
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A in memory",
  );
});

test("replacing a rejected local record requires stated consequences and cancellation preserves bytes", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const link = createShareUrl(
    exampleBill(),
    "entered",
    base.origin,
    base.pathname,
  );
  await page.goto("./");
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "corrupt prior data"),
    SESSION_STORAGE_KEY,
  );
  for (const address of [link, base.href]) {
    await page.goto(address);
    const title = await page
      .getByLabel("Dinner title", { exact: true })
      .inputValue();
    const actions =
      address === link
        ? ["Edit a copy", "Start new dinner"]
        : ["Start new dinner"];
    for (const name of actions) {
      page.once("dialog", async (d) => {
        expect(d.message()).toContain("may replace its stored record");
        await d.dismiss();
      });
      await page.getByRole("button", { name, exact: true }).click();
      expect(page.url()).toBe(address);
      await expect(
        page.getByLabel("Dinner title", { exact: true }),
      ).toHaveValue(title);
      expect(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          SESSION_STORAGE_KEY,
        ),
      ).toBe("corrupt prior data");
    }
  }
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Start new dinner", exact: true })
    .click();
  expect(new URL(page.url()).search).toMatch(/^\?draft=/);
  await expect(page.getByLabel("Total bill amount")).toHaveValue("0.00");
});

test("failed draft navigation preserves the existing session record", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const link = createShareUrl(
    exampleBill(),
    "entered",
    base.origin,
    base.pathname,
  );
  const session = newSession(exampleBill()),
    raw = JSON.stringify(session);
  await page.goto(link);
  await page.evaluate(
    ({ key, raw }) => {
      sessionStorage.setItem(key, raw);
      history.pushState = () => {
        throw new DOMException("History unavailable", "SecurityError");
      };
    },
    { key: SESSION_STORAGE_KEY, raw },
  );
  await page.getByRole("button", { name: "Edit a copy", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "stored records are unchanged",
  );
  expect(page.url()).toBe(link);
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      SESSION_STORAGE_KEY,
    ),
  ).toBe(raw);
  await expect(page.getByTestId("payment-0")).toHaveText("$62.67");
});
