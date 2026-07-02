import { test, expect } from '@playwright/test';

test.describe('Chat Simulator Workflow', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.route('**/api/tenant/features', async (route) => {
      await route.fulfill({ json: { chatSimulator: true } });
    });

    await page.route('**/api/v1/models', async (route) => {
      await route.fulfill({ json: { models: [{ id: 'llama3', name: 'Llama 3' }] } });
    });
  });

  test('Should send a message and receive a streamed response', async ({ page }) => {
    await page.goto('/chat');

    await expect(page.locator('h1', { hasText: 'Chat with your Documents' })).toBeVisible();

    const input = page.locator('input[type="text"]').or(page.locator('textarea'));
    await input.fill('Hello AI');
    
    // Mock the chat response
    await page.route('**/api/v1/chat', async (route) => {
      await route.fulfill({ 
        json: { 
          message: { role: 'assistant', content: 'Hello Human. I am RAG AI.' },
          sources: []
        } 
      });
    });

    await input.press('Enter');

    // User message should appear
    await expect(page.locator('text=Hello AI')).toBeVisible();

    // Assistant message should eventually appear
    await expect(page.locator('text=Hello Human. I am RAG AI.')).toBeVisible();
  });

  test('Should toggle advanced search options', async ({ page }) => {
    await page.goto('/chat');
    
    const advancedToggle = page.locator('button', { hasText: /Advanced Search/i });
    await advancedToggle.click();

    await expect(page.locator('text=Section Path')).toBeVisible();
    await expect(page.locator('text=Content Types')).toBeVisible();
  });
});
