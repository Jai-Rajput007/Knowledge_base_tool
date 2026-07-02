import { test, expect } from '@playwright/test';

test.describe('End-to-End Workflow Integration', () => {
  test('Should navigate from RAG to MCP and test Chat Simulator', async ({ page }) => {
    // 1. Visit Dashboard Home
    await page.goto('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();

    // 2. Navigate to RAG
    await page.goto('/rag');
    await expect(page.locator('h1', { hasText: 'Robot RAG' })).toBeVisible();
    
    // Ensure the DocumentList component loaded (assuming it says "Uploaded Documents")
    await expect(page.locator('h3', { hasText: 'Uploaded Documents' })).toBeVisible();

    // 3. Navigate to MCP Settings
    await page.goto('/mcp');
    await expect(page.locator('h1', { hasText: 'Model Context Protocol' })).toBeVisible();
    
    // Ensure the IntegrationCard loaded
    await expect(page.locator('text=Google Drive')).toBeVisible();

    // 4. Navigate to Chat Simulator
    await page.goto('/chat');
    await expect(page.locator('h1', { hasText: 'Chat with your Documents' })).toBeVisible();

    // Interact with Chat Simulator - toggle advanced options
    const advancedToggle = page.locator('button', { hasText: /Advanced Search/i });
    await advancedToggle.click();
    await expect(page.locator('text=Section Path')).toBeVisible();

    // Send a message
    const input = page.locator('textarea');
    await input.fill('What is MCP?');
    await page.keyboard.press('Enter');

    // Wait for the response bubble to appear
    await expect(page.locator('.bg-card.border.border-border')).toBeVisible({ timeout: 10000 });
  });
});
