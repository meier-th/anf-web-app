import {expect, test} from '@playwright/test';

test('loads start page', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ANF/i);
});
