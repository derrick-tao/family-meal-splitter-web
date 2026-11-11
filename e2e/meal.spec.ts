import { test, expect } from "@playwright/test";
test("build a dinner, adjust independent portions, copy, and restore", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ })
    .fill("100.01");
  await page
    .getByRole("button", { name: /Add (a )?household/i, exact: true })
    .click();
  await page.getByLabel("Household 1 name").fill("Family A");
  await page.getByRole("button", { name: "Add Child", exact: true }).click();
  await page.getByLabel("Child 1 name in Family A").fill("Child A1");
  await page.getByLabel("Age of Child A1", { exact: true }).fill("6");
  await expect(
    page.getByLabel("Portion for Child A1", { exact: true }),
  ).toHaveValue("30");
  await page.getByRole("button", { name: "Add Child", exact: true }).click();
  await page.getByLabel("Child 2 name in Family A").fill("Child A2");
  await page.getByLabel("Age of Child A2", { exact: true }).fill("4");
  await page.getByLabel("Portion for Child A1", { exact: true }).focus();
  await page
    .getByLabel("Portion for Child A1", { exact: true })
    .press("ArrowRight");
  await expect(
    page.getByLabel("Portion for Child A1", { exact: true }),
  ).toHaveValue("35");
  await expect(
    page.getByLabel("Portion for Child A2", { exact: true }),
  ).toHaveValue("25");
  await page
    .getByRole("button", { name: /Add (a )?household/i, exact: true })
    .click();
  await page.getByLabel("Household 2 name").fill("Family B");
  await expect(page.getByTestId("payment-0")).toHaveText("$61.54");
  await expect(page.getByTestId("payment-1")).toHaveText("$38.47");
  await page.getByRole("button", { name: "Copy Message" }).click();
  await expect(page.getByRole("status")).toContainText("Message copied!");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(await page.getByTestId("message").innerText());
  expect(copied).toContain("Child A1: 35%");
  await page.reload();
  await expect(
    page.getByLabel("Portion for Child A1", { exact: true }),
  ).toHaveValue("35");
  await expect(page.getByTestId("payment-0")).toHaveText("$61.54");
  await page.getByLabel("Age of Child A1", { exact: true }).fill("10");
  await expect(
    page.getByLabel("Portion for Child A1", { exact: true }),
  ).toHaveValue("35");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("example dinner and slider update; New bill can be cancelled", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Try an example|Load Example Dinner/ })
    .click();
  for (const [i, amount] of ["$62.67", "$40.44", "$90.98", "$60.65"].entries())
    await expect(page.getByTestId(`payment-${i}`)).toHaveText(amount);
  const slider = page.getByLabel("Portion for Child A2", { exact: true });
  await slider.focus();
  for (let i = 0; i < 4; i++) await slider.press("ArrowRight");
  await expect(page.getByTestId("payment-0")).toHaveText("$68.58");
  await expect(page.getByTestId("message")).toContainText("Child A2: 50%");
  await page.getByRole("button", { name: "New bill", exact: true }).click();
  await page.getByRole("button", { name: "Keep my bill" }).click();
  await expect(slider).toHaveValue("50");
  await page.screenshot({
    path: `test-results/dinner-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "New bill", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start new bill", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: /^(Dinner total|Total bill amount)$/ }),
  ).toHaveValue("0.00");
  await expect(page.getByTestId("payment-0")).toHaveCount(0);
});
