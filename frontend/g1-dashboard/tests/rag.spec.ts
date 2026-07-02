import { test, expect } from '@playwright/test';

test.describe('RAG Module Workflow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Route mocks
    await page.route('**/api/tenant/features', async (route) => {
      await route.fulfill({ json: { rag: true } });
    });

    await page.route('**/api/v1/documents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: [] });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ json: { id: '999', status: 'processing' } });
      } else {
        await route.fulfill({ status: 200 });
      }
    });
  });

  test('Should upload a document and show it in the list', async ({ page }) => {
    await page.goto('/rag');

    // Wait for header to ensure page loaded
    await expect(page.locator('h1', { hasText: 'Robot RAG' })).toBeVisible();

    // Check upload button exists
    const uploadBtn = page.locator('button', { hasText: 'Upload Document' });
    await expect(uploadBtn).toBeVisible();

    // Trigger file chooser and upload a dummy file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('dummy content')
    });

    // Mock GET documents to return the new file after upload
    await page.route('**/api/v1/documents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ 
          json: [{
            id: '999',
            name: 'test.pdf',
            size: '10 KB',
            file_type: 'PDF',
            status: 'processing',
            created_at: new Date().toISOString(),
            chunks_count: 0
          }] 
        });
      } else {
        await route.fulfill({ status: 200 });
      }
    });

    // The document should appear in the table/list
    await expect(page.locator('text=test.pdf')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=processing')).toBeVisible();
  });
});
