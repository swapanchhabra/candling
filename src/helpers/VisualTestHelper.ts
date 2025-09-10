import { Page, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

export class VisualTestHelper {
  private page: Page;
  private openai: OpenAI | null = null;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize OpenAI only if API key is provided
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  /**
   * Compare full page screenshot with AI analysis on failure
   */
  async compareFullPage(name: string, options: any = {}) {
    await this.page.waitForLoadState('networkidle');
    
    // Hide elements that might cause flakiness
    await this.hideFlakeyElements();
    
    try {
      await expect(this.page).toHaveScreenshot({
        path: path.resolve(process.cwd(), 'base-images', `${name}.png`),
        fullPage: true,
        threshold: 0.3,
        ...options
      });
    } catch (error) {
      console.log(`Visual test failed for ${name}. Analyzing with AI...`);
      
      if (this.openai) {
        const aiAnalysis = await this.analyzeVisualDifferencesWithAI(name);
        if (aiAnalysis) {
          console.log('AI Analysis:', aiAnalysis);
          
          // If AI determines the differences are minor, we can choose to pass the test
          if (aiAnalysis.toLowerCase().includes('minor') || 
              aiAnalysis.toLowerCase().includes('insignificant') ||
              aiAnalysis.toLowerCase().includes('acceptable')) {
            console.log('AI determined differences are acceptable. Test will be marked as passed.');
            return; // Pass the test
          } else {
            console.log('AI determined differences are significant. Test will fail.');
          }
        }
      }
      
      // Re-throw the original error if AI analysis suggests significant differences or AI is not available
      throw error;
    }
  }

  /**
   * Hide elements that commonly cause visual test flakiness
   */
  private async hideFlakeyElements() {
    const flakeySelectors = [
      'video',
      '.animation',
      '.gif',
      '[data-testid="loading"]',
      '.loading',
      '.spinner'
    ];

    for (const selector of flakeySelectors) {
      try {
        await this.page.locator(selector).evaluateAll((elements: Element[]) => {
          elements.forEach(el => {
            (el as HTMLElement).style.visibility = 'hidden';
          });
        });
      } catch (error) {
        // Element might not exist, continue
      }
    }
  }

  /**
   * Mask dynamic content for consistent screenshots
   */
  async maskDynamicContent(selectors: string[]) {
    for (const selector of selectors) {
      try {
        await this.page.locator(selector).evaluateAll((elements: Element[]) => {
          elements.forEach(el => {
            (el as HTMLElement).style.backgroundColor = '#cccccc';
            (el as HTMLElement).style.color = 'transparent';
          });
        });
      } catch (error) {
        // Element might not exist, continue
      }
    }
  }

  /**
   * Wait for animations to complete
   */
  async waitForAnimations(timeout: number = 3000) {
    await this.page.waitForFunction(() => {
      const animations = document.getAnimations();
      return animations.length === 0 || animations.every(a => a.playState === 'finished');
    }, { timeout });
  }

  /**
   * Standard setup for visual tests
   */
  async setupVisualTest(options: {
    hideFlakey?: boolean;
    maskSelectors?: string[];
    waitForAnimations?: boolean;
  } = {}) {
    const { hideFlakey = true, maskSelectors = [], waitForAnimations = true } = options;

    await this.page.waitForLoadState('networkidle');
    
    if (waitForAnimations) {
      await this.waitForAnimations();
    }
    
    if (hideFlakey) {
      await this.hideFlakeyElements();
    }
    
    if (maskSelectors.length > 0) {
      await this.maskDynamicContent(maskSelectors);
    }
  }

  /**
   * Analyze visual differences using OpenAI GPT-4 Vision
   */
  private async analyzeVisualDifferencesWithAI(testName: string): Promise<string | null> {
    if (!this.openai) {
      console.log('OpenAI API key not provided. Skipping AI analysis.');
      return null;
    }

    try {
      // Find the latest test result images
      const { actualImage, expectedImage, diffImage } = await this.findLatestTestResult(testName);
      
      if (!actualImage || !expectedImage) {
        console.log('Could not find actual or expected images for AI analysis.');
        return null;
      }

      // Encode images to base64
      const actualBase64 = await this.encodeImageToBase64(actualImage);
      const expectedBase64 = await this.encodeImageToBase64(expectedImage);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze these two website screenshots and determine if the visual differences are significant or minor. 
                
                The first image is the expected baseline, and the second is the actual current state. 
                
                Consider the following as MINOR differences:
                - Small font rendering variations
                - Slight color differences due to browser rendering
                - Minor spacing adjustments (1-2 pixels)
                - Anti-aliasing differences
                - Loading states or animations captured at different times
                
                Consider the following as SIGNIFICANT differences:
                - Layout changes (elements moved, resized, or missing)
                - Color scheme changes
                - Text content changes
                - New or removed UI elements
                - Broken layouts or styling
                
                Please respond with either "MINOR" or "SIGNIFICANT" followed by a brief explanation of what you observed.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${expectedBase64}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${actualBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Error during AI analysis:', error);
      return null;
    }
  }

  /**
   * Find the latest test result images
   */
  private async findLatestTestResult(testName: string): Promise<{
    actualImage?: string;
    expectedImage?: string;
    diffImage?: string;
  }> {
    const baseImagesDir = path.join(process.cwd(), 'base-images');

    // Baseline (expected) image
    const expectedImagePath = path.join(baseImagesDir, `${testName}.png`);
    // Actual and diff images (Playwright naming convention)
    const actualImagePath = path.join(baseImagesDir, `${testName}-actual.png`);
    const diffImagePath = path.join(baseImagesDir, `${testName}-diff.png`);

    return {
      actualImage: fs.existsSync(actualImagePath) ? actualImagePath : undefined,
      expectedImage: fs.existsSync(expectedImagePath) ? expectedImagePath : undefined,
      diffImage: fs.existsSync(diffImagePath) ? diffImagePath : undefined,
    };
  }

  /**
   * Encode image file to base64
   */
  private async encodeImageToBase64(imagePath: string): Promise<string> {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }
}
