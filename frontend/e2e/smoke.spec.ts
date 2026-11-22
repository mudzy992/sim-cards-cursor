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
    const darkItem = page.getByRole('menuitem', { name: /tamn|dark/i });
    await expect(darkItem).toBeVisible();
    await darkItem.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(darkItem).toBeHidden();

    await themeBtn.click();
    const lightItem = page.getByRole('menuitem', { name: /svijetl|light/i });
    await expect(lightItem).toBeVisible();
    await lightItem.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(lightItem).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('switches UI language between Bosnian and English', async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/login');
    const langBtn = page.getByRole('button', { name: /jezik|language/i });
    await expect(langBtn).toBeVisible();

    await langBtn.click();
    const englishItem = page.getByRole('menuitem', { name: /englesk|english/i });
    await expect(englishItem).toBeVisible();
    await englishItem.click();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
    await expect(englishItem).toBeHidden();

    await langBtn.click();
    const bosnianItem = page.getByRole('menuitem', { name: /bosansk|bosnian/i });
    await expect(bosnianItem).toBeVisible();
    await bosnianItem.click();
    await expect(page.getByRole('button', { name: /prijav/i })).toBeVisible();
    await expect(bosnianItem).toBeHidden();

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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    await page.goto('/sim-cards');
    await expect(page).toHaveURL(/\/shipments/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    for (const route of [
      '/shipments',
      '/shipments/new',
      '/installation-records',
      '/installation-records/new',
      '/meters',
      '/install-tasks',
      '/demount-tasks',
      '/meter-types/new',
      '/meter-type-fields',
      '/analytics',
      '/settings',
      '/settings/email',
      '/users',
      '/branch-moderators',
      '/branch-email-recipients',
      '/push-campaigns',
      '/activity-log',
      '/app-releases',
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('#main-content')).not.toBeEmpty();
    }

    await page.goto('/meters');
    await expect(page.locator('.ant-table-wrapper')).toBeVisible({ timeout: 15_000 });

    expect(errors).toEqual([]);
  });
});
