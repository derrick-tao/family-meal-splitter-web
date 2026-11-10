import { test, expect, type Page } from "@playwright/test";
import { exampleBill, STORAGE_KEY } from "../lib/meal";
import { createShareUrl } from "../lib/sharing";
const sharedKey = "family-meal-splitter-shared-v1";
async function share(page: Page, entered = false) {
  await page.getByRole("button", { name: "Share dinner", exact: true }).click();
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
test("share an editable snapshot and preserve normal and shared drafts", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Load Example Dinner" }).click();
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A dinner");
  await expect(page.getByTestId("message")).toContainText("Family A dinner");
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
  for (const [i, value] of ["$62.67", "$40.44", "$90.98", "$60.65"].entries())
    await expect(other.getByTestId(`payment-${i}`)).toHaveText(value);
  const slider = other.getByLabel("Portion for Child A2", { exact: true });
  await slider.focus();
  for (let i = 0; i < 4; i++) await slider.press("ArrowRight");
  await expect(other.getByTestId("payment-0")).toHaveText("$68.58");
  await other.reload();
  await expect(slider).toHaveValue("50");
  expect(
    await other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(ordinary);
  await expect(page.getByTestId("payment-0")).toHaveText("$62.67");
  const revised = await share(other, true);
  expect(revised).not.toBe(fullUrl);
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(revised);
  await expect(freshPage.getByTestId("payment-0")).toHaveText("$68.58");
  await freshPage.goto(fullUrl);
  await expect(freshPage.getByTestId("payment-0")).toHaveText("$62.67");
  await other.getByRole("link", { name: "family meal splitter" }).click();
  expect(other.url()).toBe(fullUrl);
  await other
    .getByRole("button", { name: "Reload original snapshot", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Reload original", exact: true })
    .click();
  await expect(slider).toHaveValue("30");
  await other
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  await expect(other.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family B dinner",
  );
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
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
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

test("only the most recently edited shared draft is retained and ordinary incomplete drafts survive", async ({
  page,
}) => {
  const base = new URL(test.info().project.use.baseURL as string);
  const first = exampleBill();
  first.title = "Family A dinner";
  const second = exampleBill();
  second.title = "Family B dinner";
  const firstUrl = createShareUrl(first, "entered", base.origin, base.pathname),
    secondUrl = createShareUrl(second, "entered", base.origin, base.pathname);
  await page.goto("./");
  const legacy = { ...exampleBill(), amount: "incomplete" } as Partial<
    ReturnType<typeof exampleBill>
  >;
  delete legacy.title;
  await page.evaluate(
    ({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)),
    { key: STORAGE_KEY, legacy },
  );
  await page.reload();
  await expect(page.getByLabel("Total bill amount")).toHaveValue("incomplete");
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
  const ordinary = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  await page.goto(firstUrl);
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family A edited");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), sharedKey))
    .toContain("Family A edited");
  const saved = await page.evaluate(
    (key) => localStorage.getItem(key),
    sharedKey,
  );
  await page.goto(secondUrl);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family B dinner",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), sharedKey),
  ).toBe(saved);
  await page
    .getByLabel("Dinner title", { exact: true })
    .fill("Family B edited");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), sharedKey))
    .toContain("Family B edited");
  await page.goto(firstUrl);
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A dinner",
  );
  await page
    .getByRole("button", { name: "Open my saved dinner", exact: true })
    .click();
  await expect(page.getByLabel("Total bill amount")).toHaveValue("incomplete");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(ordinary);
});
test("unsaved shared edits require confirmation before returning to the saved dinner", async ({
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
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Dinner bill",
  );
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
  await expect(page.getByLabel("Dinner title", { exact: true })).toHaveValue(
    "Family A unsaved",
  );
  expect(page.url()).toBe(link);
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
    .poll(() => page.evaluate((key) => localStorage.getItem(key), sharedKey))
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
