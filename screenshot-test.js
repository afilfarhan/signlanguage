const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  
  const page = await context.newPage();
  await page.goto('http://localhost:3000/learn/asl/fingerspelling/a', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'letter-a-test.png'), fullPage: true });
  console.log('Screenshot saved to screenshots/letter-a-test.png');
  
  await browser.close();
})();
