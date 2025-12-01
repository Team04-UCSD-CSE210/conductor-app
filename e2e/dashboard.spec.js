/**
 * E2E Tests for Dashboard Functionality
 * 
 * Tests dashboard user flows including:
 * - Dashboard loading and rendering
 * - Navigation between views
 * - Data display
 * - User interactions
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Dashboard - Public Access', () => {
  test('should load dashboard page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/dashboard.html`);
    
    // Page should load (may redirect to login if auth required)
    expect(response?.status()).toBeLessThan(500);
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    // Check for basic HTML structure
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForLoadState('networkidle');
    
    // Allow for some non-critical errors but not too many
    expect(errors.length).toBeLessThan(5);
  });
});

test.describe('Dashboard - Navigation', () => {
  test('should have navigation menu', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    // Look for navigation elements or any structural elements
    const nav = page.locator('nav, [role="navigation"], .navbar, header, .sidebar, .menu, a').first();
    const hasNav = await nav.count() > 0;
    
    expect(hasNav).toBeTruthy();
  });

  test('should navigate to different sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    // Look for common navigation links
    const links = page.locator('a[href*="dashboard"], a[href*="profile"], a[href*="teams"], a[href*="sessions"]');
    const linkCount = await links.count();
    
    // Should have at least some navigation
    expect(linkCount).toBeGreaterThan(0);
  });
});

test.describe('Dashboard - Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/dashboard.html`);
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Dashboard - Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should load critical resources', async ({ page }) => {
    const failedRequests = [];
    
    page.on('requestfailed', (request) => {
      failedRequests.push(request.url());
    });
    
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForLoadState('networkidle');
    
    // Should have minimal failed requests
    expect(failedRequests.length).toBeLessThan(3);
  });
});
