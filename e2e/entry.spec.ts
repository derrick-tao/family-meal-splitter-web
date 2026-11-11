import { test, expect, type Page } from "@playwright/test";
import { cleanBill, DEFAULT_TITLE } from "../lib/meal";
import { TAB_BILL_KEY, serializeTabBill } from "../lib/tab-bill";

const amount = (page: Page) =>
  page.getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ });
const add = (page: Page) =>
  page.getByRole("button", { name: "Add a household", exact: true });
const title = (page: Page) => page.getByLabel("Dinner title", { exact: true });
const newBill = (page: Page) =>
  page.getByRole("button", { name: "New bill", exact: true });
const raw = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), TAB_BILL_KEY);
async function cleanEntry(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Let’s split dinner." }),
  ).toBeVisible();
  await expect(amount(page)).toHaveValue("0.00");
  await expect(newBill(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy Message" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".bill-stats, .results-column, .bill-status"),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Saved in this tab|Use Share|Ready to edit/),
  ).toHaveCount(0);
  await expect(title(page)).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "INPUT",
  );
}

test("new and restored clean bills match the bill-first entry across mobile widths", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await cleanEntry(page);
  for (const [width, height] of [
    [390, 844],
    [320, 844],
    [393, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(add(page)).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Try an example" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/entry-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
  await expect(page.locator(".entry-plate")).toHaveJSProperty(
    "naturalWidth",
    640,
  );
  const source = await page.locator(".entry-plate").getAttribute("src");
  expect(source).toMatch(/\/dinner-plate.webp$/);
  expect(await page.locator(".entry-plate").getAttribute("alt")).toBe("");
  await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), {
    key: TAB_BILL_KEY,
    value: serializeTabBill(cleanBill()),
  });
  await page.reload();
  await cleanEntry(page);
  expect(errors).toEqual([]);
});

test("typing preserves amount DOM, caret and position; optional title only focuses after explicit reveal", async ({
  page,
}) => {
  await page.goto("./");
  await cleanEntry(page);
  const box = await amount(page).boundingBox();
  await amount(page).evaluate((node) => {
    node.setAttribute("data-original-input", "true");
  });
  await amount(page).focus();
  await amount(page).press("ControlOrMeta+A");
  await amount(page).pressSequentially("12.34");
  await expect(amount(page)).toBeFocused();
  await expect(amount(page)).toHaveAttribute("data-original-input", "true");
  expect(
    await amount(page).evaluate(
      (node) => (node as HTMLInputElement).selectionStart,
    ),
  ).toBe(5);
  expect((await amount(page).boundingBox())?.y).toBe(box?.y);
  await expect(newBill(page)).toBeVisible();
  await expect(page.locator(".results-column")).toHaveCount(0);
  const saved = await raw(page);
  await page.getByRole("button", { name: "Add a dinner name" }).click();
  await expect(title(page)).toBeFocused();
  await expect(title(page)).toHaveValue(DEFAULT_TITLE);
  expect(await raw(page)).toBe(saved);
  await title(page).evaluate((node) =>
    node.setAttribute("data-original-title", "true"),
  );
  await title(page).press("ControlOrMeta+A");
  await title(page).pressSequentially("Family A dinner");
  await expect(title(page)).toBeFocused();
  await expect(title(page)).toHaveAttribute("data-original-title", "true");
  await title(page).blur();
  await title(page).focus();
  await expect(title(page)).toHaveValue("Family A dinner");
  await page.reload();
  await expect(title(page)).toBeVisible();
  await expect(title(page)).toHaveValue("Family A dinner");
  await expect(title(page)).not.toBeFocused();
  await title(page).evaluate((node) =>
    node.setAttribute("data-restored-title", "true"),
  );
  await title(page).focus();
  await title(page).press("ControlOrMeta+A");
  await title(page).pressSequentially(DEFAULT_TITLE);
  await expect(title(page)).toHaveValue(DEFAULT_TITLE);
  await expect(title(page)).toBeVisible();
  await expect(title(page)).toBeFocused();
  await expect(title(page)).toHaveAttribute("data-restored-title", "true");
  await title(page).fill("");
  await page.reload();
  await expect(title(page)).toBeVisible();
  await expect(title(page)).toHaveValue("");
  await expect(title(page)).not.toBeFocused();
});

test("UI expansion leaves a clean bill clean; New bill cancellation and replacement preserve their guarantees", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add a dinner name" }).click();
  await expect(title(page)).toBeFocused();
  expect(await raw(page)).toBeNull();
  await expect(newBill(page)).toHaveCount(0);
  await title(page).fill("Family B dinner");
  await amount(page).fill("12.");
  await amount(page).blur();
  const saved = await raw(page),
    address = page.url();
  await newBill(page).click();
  await page.getByRole("button", { name: "Keep my bill" }).click();
  expect(await raw(page)).toBe(saved);
  expect(page.url()).toBe(address);
  await expect(amount(page)).toHaveValue("12.00"); // existing valid-on-blur formatting
  await expect(title(page)).toHaveValue("Family B dinner");
  await newBill(page).click();
  await page
    .getByRole("button", { name: "Start new bill", exact: true })
    .click();
  await cleanEntry(page);
});

for (const value of ["0.00", "incomplete"]) {
  test(`first household accepts ${value}, preserves title/tone and final removal returns focus`, async ({
    page,
  }) => {
    const bill = {
      ...cleanBill(),
      title: "Family A dinner",
      tone: "simple" as const,
      amount: value,
    };
    await page.goto("./");
    await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), {
      key: TAB_BILL_KEY,
      raw: serializeTabBill(bill),
    });
    await page.reload();
    if (value === "incomplete")
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "decimal places",
      );
    await add(page).click();
    const name = page.getByLabel("Household 1 name");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("");
    await expect(amount(page)).toHaveValue(value);
    const stored = JSON.parse((await raw(page))!).bill;
    expect(stored.title).toBe(bill.title);
    expect(stored.tone).toBe("simple");
    expect(stored.households).toHaveLength(1);
    expect(stored.households[0]).toMatchObject({
      name: "",
      adults: 1,
      children: [],
    });
    expect(stored.households[0].id).toMatch(/^[a-f0-9-]{36}$/);
    await page
      .getByRole("button", { name: "Remove Household 1", exact: true })
      .click();
    await expect(add(page)).toBeFocused();
    await expect(amount(page)).toHaveValue(value);
    await expect(title(page)).toHaveValue(bill.title);
    await expect(title(page)).toBeVisible();
    await expect(page.locator(".results-column")).toHaveCount(0);
  });
}

test("unreadable blank fallback exposes confirmed recovery without rewriting bytes", async ({
  page,
}) => {
  const bytes = "{unreadable active bill";
  await page.goto("./");
  await page.evaluate(({ key, bytes }) => sessionStorage.setItem(key, bytes), {
    key: TAB_BILL_KEY,
    bytes,
  });
  await page.reload();
  await expect(newBill(page)).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "previous bill" }),
  ).toContainText("stored data is preserved");
  await expect(page.locator("main")).not.toContainText(/use Share|Make a copy/);
  for (const action of [
    newBill(page),
    page.getByRole("button", { name: "Try an example" }),
  ]) {
    await action.click();
    await expect(page.getByRole("dialog")).toContainText("could not be read");
    await page.getByRole("button", { name: "Keep my bill" }).click();
    expect(await raw(page)).toBe(bytes);
  }
  await amount(page).fill("incomplete");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "decimal places",
  );
  expect(await raw(page)).toBe(bytes);
  await newBill(page).click();
  await page
    .getByRole("button", { name: "Start new bill", exact: true })
    .click();
  await cleanEntry(page);
  expect(await raw(page)).toBe(serializeTabBill(cleanBill()));
});

test("zero-household quota warning stays visible and has no unavailable Share instruction", async ({
  page,
}) => {
  await page.goto("./");
  const saved = serializeTabBill(cleanBill());
  await page.evaluate(({ key, saved }) => sessionStorage.setItem(key, saved), {
    key: TAB_BILL_KEY,
    saved,
  });
  await page.reload();
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === sessionStorage && k === key) throw new Error("quota");
      return set.call(this, k, v);
    };
  }, TAB_BILL_KEY);
  await amount(page).fill("14.25");
  await expect(
    page.getByRole("status").filter({ hasText: "Changes are not saved" }),
  ).toContainText("refreshing or leaving may lose edits");
  await expect(page.locator("main")).not.toContainText(
    /Use Share|use Share|Saved in this tab\./,
  );
  expect(await raw(page)).toBe(saved);
});

test("visible Dinner total names its input; rejected navigation preserves title expansion and accepted memory replacement resets it", async ({
  page,
}) => {
  await page.goto("./");
  const dinnerTotal = page.getByRole("textbox", {
    name: "Dinner total",
    exact: true,
  });
  await expect(dinnerTotal).toBeVisible();
  await expect(page.locator('label[for="bill-amount"]')).toHaveText(
    "Dinner total",
  );
  await page.getByRole("button", { name: "Add a dinner name" }).click();
  await expect(title(page)).toBeFocused();
  await dinnerTotal.fill("14.25");
  await dinnerTotal.blur();
  const saved = await raw(page);
  await page.evaluate(() => {
    history.pushState(null, "", "?review=1");
    const pushState = history.pushState.bind(history);
    history.pushState = () => {
      throw new Error("history unavailable");
    };
    Object.defineProperty(window, "restoreEntryHistory", {
      value: () => {
        history.pushState = pushState;
      },
    });
  });
  const address = page.url();
  await newBill(page).click();
  await page
    .getByRole("button", { name: "Start new bill", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "action could not" }),
  ).toContainText("unchanged");
  await expect(
    page.getByRole("button", { name: "Dinner name", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(title(page)).toBeVisible();
  await expect(title(page)).toHaveValue(DEFAULT_TITLE);
  await expect(dinnerTotal).toHaveValue("14.25");
  expect(page.url()).toBe(address);
  expect(await raw(page)).toBe(saved);
  await page.evaluate((key) => {
    (
      window as unknown as { restoreEntryHistory: () => void }
    ).restoreEntryHistory();
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (this === sessionStorage && k === key) throw new Error("quota");
      return set.call(this, k, value);
    };
  }, TAB_BILL_KEY);
  await newBill(page).click();
  await page
    .getByRole("button", { name: "Start new bill", exact: true })
    .click();
  await cleanEntry(page);
  await expect(
    page.getByRole("status").filter({ hasText: "Changes are not saved" }),
  ).toContainText("previously stored bill is preserved");
  expect(await raw(page)).toBe(saved);
  expect(new URL(page.url()).search).toBe("");
});

test("entry secondary text, placeholder and actions meet AA text contrast", async ({
  page,
}) => {
  await page.goto("./");
  await amount(page).fill("14.25");
  await page.getByRole("button", { name: "Add a dinner name" }).click();
  await title(page).fill("");
  const contrasts = await page.evaluate(() => {
    type RGB = [number, number, number];
    function rgba(value: string): [number, number, number, number] {
      const parts = value.match(/[\d.]+/g)!.map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    }
    function background(node: Element | null): RGB {
      if (!node) return [255, 255, 255];
      const [r, g, b, alpha] = rgba(getComputedStyle(node).backgroundColor);
      const behind = background(node.parentElement);
      return [r, g, b].map(
        (value, i) => value * alpha + behind[i] * (1 - alpha),
      ) as RGB;
    }
    function luminance(color: RGB) {
      const linear = color.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    const selectors = [
      ".entry-intro > p",
      ".entry-helper",
      ".entry-joining > p",
      ".entry-save",
      ".entry-amount .currency-code",
      ".entry-total-heading .button",
      ".entry-title .helper",
      ".entry-title-toggle",
      ".entry-example",
      ".entry-add",
      ".entry-title .input::placeholder",
    ];
    return selectors.map((selector) => {
      const placeholder = selector.endsWith("::placeholder");
      const node = document.querySelector(
        placeholder ? selector.replace("::placeholder", "") : selector,
      )!;
      const style = getComputedStyle(
        node,
        placeholder ? "::placeholder" : null,
      );
      const foreground = rgba(style.color).slice(0, 3) as RGB;
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background(node));
      return {
        selector,
        ratio:
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      };
    });
  });
  for (const { selector, ratio } of contrasts)
    expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
});
