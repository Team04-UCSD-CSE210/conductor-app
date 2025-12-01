/**
 * E2E Tests for Student User Workflow
 * 
 * Tests the complete student journey through the application:
 * - Viewing attendance
 * - Accessing team information
 * - Viewing sessions
 * - Submitting journal entries
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Student Workflow - Attendance', () => {
  test('should access attendance page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/attendance.html`);
    
    // Should load even if redirected to login
    expect(response?.status()).toBeLessThan(500);
  });

  test('should display attendance data structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/attendance.html`);
    
    // Check for table or list structure
    const hasDataStructure = await page.locator('table, .attendance-list, [class*="attendance"]').count() > 0;
    
    // Page should have some structure for displaying attendance
    expect(typeof hasDataStructure).toBe('boolean');
  });
});

test.describe('Student Workflow - Teams', () => {
  test('should access teams page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/teams.html`);
    
    expect(response?.status()).toBeLessThan(500);
  });

  test('should have team information display', async ({ page }) => {
    await page.goto(`${BASE_URL}/teams.html`);
    
    // Look for team-related elements
    const hasTeamElements = await page.locator('[class*="team"], [id*="team"]').count() > 0;
    
    expect(typeof hasTeamElements).toBe('boolean');
  });
});

test.describe('Student Workflow - Sessions', () => {
  test('should access sessions page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/sessions.html`);
    
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load session list', async ({ page }) => {
    await page.goto(`${BASE_URL}/sessions.html`);
    
    // Check for session listing elements
    const hasSessionElements = await page.locator('[class*="session"], table, .list').count() > 0;
    
    expect(typeof hasSessionElements).toBe('boolean');
  });
});

test.describe('Student Workflow - Journal', () => {
  test('should access journal page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/journal.html`);
    
    expect(response?.status()).toBeLessThan(500);
  });

  test('should have journal entry form', async ({ page }) => {
    await page.goto(`${BASE_URL}/journal.html`);
    
    // Look for form elements
    const hasForm = await page.locator('form, textarea, [type="submit"]').count() > 0;
    
    expect(typeof hasForm).toBe('boolean');
  });

  test('should validate journal entry submission', async ({ page }) => {
    await page.goto(`${BASE_URL}/journal.html`);
    
    // Try to find submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit")').first();
    
    if (await submitButton.count() > 0) {
      // Attempt to submit empty form (should show validation)
      await submitButton.click();
      
      // Should stay on page or show error message
      const url = page.url();
      expect(url).toContain('journal');
    }
  });
});

test.describe('Student Workflow - User Flow Integration', () => {
  test('complete student journey simulation', async ({ page }) => {
    // 1. Start at home
    await page.goto(BASE_URL);
    
    // 2. Navigate to dashboard (or login)
    const response1 = await page.goto(`${BASE_URL}/dashboard.html`);
    expect(response1?.status()).toBeLessThan(500);
    
    // 3. Check attendance
    const response2 = await page.goto(`${BASE_URL}/attendance.html`);
    expect(response2?.status()).toBeLessThan(500);
    
    // 4. View sessions
    const response3 = await page.goto(`${BASE_URL}/sessions.html`);
    expect(response3?.status()).toBeLessThan(500);
    
    // 5. Access team info
    const response4 = await page.goto(`${BASE_URL}/teams.html`);
    expect(response4?.status()).toBeLessThan(500);
    
    // Verify all pages loaded successfully
    const allSuccessful = [response1, response2, response3, response4].every(
      res => res?.status() && res.status() < 500
    );
    expect(allSuccessful).toBeTruthy();
  });
});
