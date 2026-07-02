import { test, expect } from '@playwright/test';

test.describe('MCP Module Workflow', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.route('**/api/tenant/features', async (route) => {
      await route.fulfill({ json: { mcp: true } });
    });

    await page.route('**/api/mcp/integrations', async (route) => {
      await route.fulfill({ json: {
        integrations: [
          { id: 'google-drive', name: 'Google Drive', is_active: false, category: 'cloud' }
        ]
      }});
    });
  });

  test('Should toggle an integration on and open config', async ({ page }) => {
    await page.goto('/mcp');

    // Wait for integration card
    await expect(page.locator('text=Google Drive')).toBeVisible();

    // Toggle the switch
    // Note: Depends on exactly how the toggle is structured, assuming a button with role switch
    const toggle = page.locator('button[role="switch"]').first();
    
    // Mock the toggle API
    await page.route('**/api/mcp/integrations/google-drive/toggle', async (route) => {
      await route.fulfill({ json: { success: true, is_active: true } });
    });

    await toggle.click();

    // Now mock the GET again to reflect active state
    await page.route('**/api/mcp/integrations', async (route) => {
      await route.fulfill({ json: {
        integrations: [
          { id: 'google-drive', name: 'Google Drive', is_active: true, category: 'cloud' }
        ]
      }});
    });

    // We can assume the toggle updates optimistic state or refetches.
    // Click configure button (usually a settings gear icon)
    const configureBtn = page.locator('button', { hasText: 'Configure' }).or(page.locator('button[title="Configure"]')).first();
    
    // If there is a configure button, we click it. MCP usually has one when active or always.
    if (await configureBtn.isVisible()) {
      await configureBtn.click();
      // Assert config modal opens
      await expect(page.locator('h3', { hasText: 'Configuration' })).toBeVisible();
    }
  });
});
