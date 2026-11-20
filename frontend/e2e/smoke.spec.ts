import { expect, test, type Page } from '@playwright/test';

function trackRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test.describe('Frontend browser smoke', () => {
  test('redirects unauthenticated user from /dashboard to /login and validates empty submit', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#emailOrUsername')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.getByRole('button', { name: /prijav|sign in|login/i }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('switches theme between dark and light and updates data-theme attribute', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/login');
    const themeBtn = page.getByRole('button', { name: /tem|theme/i });
    await expect(themeBtn).toBeVisible();

    await themeBtn.click();
    await page.getByRole('menuitem', { name: /tamn|dark/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('menuitem', { name: /tamn|dark/i })).toBeHidden();

    await themeBtn.click();
    await page.getByRole('menuitem', { name: /svijetl|light/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(errors).toEqual([]);
  });

  test('switches UI language between Bosnian and English', async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/login');
    const langBtn = page.getByRole('button', { name: /jezik|language/i });
    await expect(langBtn).toBeVisible();

    await langBtn.click();
    await page.getByRole('menuitem', { name: /englesk|english/i }).click();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /englesk|english/i })).toBeHidden();

    await langBtn.click();
    await page.getByRole('menuitem', { name: /bosansk|bosnian/i }).click();
    await expect(page.getByRole('button', { name: /prijav/i })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('authenticated admin login & core route navigation smoke', async ({ page }) => {
    test.skip(
      process.env.E2E_WITH_BACKEND !== 'true',
      'Full-stack browser smoke requires E2E_WITH_BACKEND=true and a running backend',
    );

    const errors = trackRuntimeErrors(page);
    const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@simtracker.local';
    const password = process.env.E2E_ADMIN_PASSWORD ?? 'CiSeedPassword!123';

    await page.goto('/login');
    await page.locator('#emailOrUsername').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /prijav|sign in|login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible();

    for (const route of ['/shipments', '/meters', '/sim-cards', '/analytics', '/settings']) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
      await expect(page.locator('#main-content')).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});
