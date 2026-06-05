import { expect, test } from "@playwright/test";

test("home page renders import workflow shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "万能导入 V2" })).toBeVisible();
  await expect(page.getByText("规则驱动的多格式批量下单")).toBeVisible();
});
