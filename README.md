# Visual Testing with Playwright and AI Fallback

This repository provides a framework for automated visual testing of websites using Playwright. If a visual regression is detected, an AI-based fallback (OpenAI) can analyze the difference and determine if it is significant or minor, allowing for smarter test results.

## Features
- Automated visual regression testing with Playwright
- AI fallback for intelligent analysis of visual differences
- Configurable baseline image storage (`base-images` folder)
- Example test for Google.com

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- Playwright
- (Optional) OpenAI API key for AI fallback

### Installation
```sh
npm install
```

### Running Tests
```sh
npx playwright test
```

### Baseline Images
Baseline screenshots are stored in the `base-images` folder at the root of the project. To update or reset baselines, simply replace the images in this folder.

### Configuration
- The base URL for tests is set in `playwright.config.ts` (currently `https://www.google.com`).
- Visual test logic and AI fallback are implemented in `src/helpers/VisualTestHelper.ts`.

### Environment Variables
To enable AI fallback, set your OpenAI API key:
```sh
export OPENAI_API_KEY=your_openai_key
```

## Folder Structure
- `tests/visual/` - Example Playwright tests
- `base-images/` - Baseline screenshots for visual comparison
- `src/helpers/VisualTestHelper.ts` - Visual test and AI logic

## License
Private repository. For internal use only.
