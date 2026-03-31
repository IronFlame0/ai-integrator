import { test, expect } from "@playwright/test";
import { mockAuthRoutes, mockChatRoutes } from "./fixtures";

test("login page renders form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("form")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("register page renders form", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator("form")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/login/);
  await expect(page).toHaveURL(/\/login/);
});

test("login with valid credentials redirects to home", async ({ page }) => {
  await mockAuthRoutes(page);
  await mockChatRoutes(page);

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("test@example.com");
  await page.locator('input[type="password"]').fill("password123");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL("/");
  await expect(page).toHaveURL("/");
});

test("login with wrong credentials shows error", async ({ page }) => {
  await mockAuthRoutes(page);

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("wrong@example.com");
  await page.locator('input[type="password"]').fill("wrongpass");
  await page.locator('button[type="submit"]').click();

  await expect(page.locator("p.text-red-600")).toBeVisible({ timeout: 5000 });
});
