import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/sign-in');
  
  // Fill credentials
  await page.locator('#email').fill('jai.s.rajput.dev@gmail.com');
  await page.locator('#password').fill('Jai@#123');
  
  // Click login
  await page.locator('button[type="submit"]').click();
  
  // Wait until the page receives the cookies/token and redirects to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {
    console.log("URL didn't change to /dashboard, continuing to save state...");
  });
  
  // Save storage state to a file
  await page.context().storageState({ path: authFile });
});
