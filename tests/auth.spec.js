// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('should successfully log in with mocked API response', async ({ page }) => {
    // 1. Intercept the login API request and mock a successful response
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Login successful',
          data: {
            user: {
              id: 'mock-user-123',
              email: 'test@example.com',
              name: 'Test User'
            }
          }
        }),
      });
    });

    // 2. Intercept the user profile check on app startup
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Not logged in'
        }),
      });
    });

    // 3. Navigate to the login page
    await page.goto('/login');

    // 4. Verify we are on the login page
    await expect(page.getByRole('heading', { name: 'LOGIN' })).toBeVisible();

    // 5. Fill in the login form
    await page.getByPlaceholder('YOUR@EMAIL.COM').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('supersecret123');

    // 6. Click the Sign In button
    await page.getByRole('button', { name: 'SIGN IN' }).click();

    // 7. Verify the UI redirects to the dashboard
    // Playwright automatically waits for the navigation to complete
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error message on failed login', async ({ page }) => {
    // Mock a failed response (e.g. wrong password)
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Invalid email or password'
        }),
      });
    });

    await page.goto('/login');

    await page.getByPlaceholder('YOUR@EMAIL.COM').fill('wrong@example.com');
    await page.getByPlaceholder('••••••••').fill('badpassword');
    await page.getByRole('button', { name: 'SIGN IN' }).click();

    // Verify the error message appears on screen
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});
