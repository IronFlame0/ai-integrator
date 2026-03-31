import { test, expect } from "@playwright/test";
import { mockChatRoutes, setAuthState, MOCK_CHAT } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await setAuthState(page);
  await mockChatRoutes(page);
});

test("sidebar is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("aside")).toBeVisible();
});

test("new chat button is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("aside button", { hasText: "Новый" })).toBeVisible();
});

test("chat list shows existing chat", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("aside button", { hasText: MOCK_CHAT.title })).toBeVisible();
});

test("model selector is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("select")).toBeVisible();
});

test("logout button is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("aside button", { hasText: "Выйти" })).toBeVisible();
});
