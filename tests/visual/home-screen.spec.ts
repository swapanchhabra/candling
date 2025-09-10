import { test, expect } from '@playwright/test';
import { VisualTestHelper } from '../../src/helpers/VisualTestHelper';

test('should verify Google home screen @visual', async ({ page }) => {
  const visualHelper = new VisualTestHelper(page);
  
  // Navigate to home screen
  await page.goto('/');
  
  // Setup visual test and compare with baseline
  await visualHelper.setupVisualTest({
    maskSelectors: [
      // Mask dynamic elements that could change
      '[aria-label="Google apps"]',
      'form[role="search"]', // Search suggestions
      '[jscontroller]' // Dynamic elements
    ]
  });
  
  // Take screenshot and compare
  await visualHelper.compareFullPage('google-home-screen');
  
  // Verify page loaded
  await expect(page).toHaveTitle('Google');
});
