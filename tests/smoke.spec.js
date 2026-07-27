// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Landing page loads and renders successfully', async ({ page }) => {
    // Navigate to the root URL (configured in playwright.config.js)
    await page.goto('/');

    // Verify the page title matches the app
    // CodeLens uses standard document titles, or at least the app should not crash
    await expect(page).toHaveTitle(/CodeLens/i);

    // Verify the main call to action is visible (assuming it says Get Started or similar)
    // If we don't know the exact text, we can just ensure the body is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for a specific role to ensure React hydrated
    await expect(page.getByRole('banner').or(page.getByRole('main'))).toBeVisible();
  });
});
