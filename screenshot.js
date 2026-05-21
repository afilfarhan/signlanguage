const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const pages = [
  { url: '/', name: '01-homepage' },
  { url: '/about', name: '02-about' },
  { url: '/learn', name: '03-learn' },
  { url: '/learn/asl/fingerspelling', name: '04-fingerspelling' },
  { url: '/learn/asl/fingerspelling/a', name: '05-letter-a' },
  { url: '/learn/asl/fingerspelling/b', name: '06-letter-b' },
  { url: '/learn/asl/settings', name: '07-settings' },
  { url: '/learn/asl/words', name: '08-words' },
  { url: '/practice', name: '09-practice' },
  { url: '/setup', name: '10-setup' },
];

const outputDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  
  for (const page of pages) {
    console.log(`Capturing ${page.name}...`);
    const p = await context.newPage();
    try {
      await p.goto(`http://localhost:3000${page.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(2000);
      await p.screenshot({ path: path.join(outputDir, `${page.name}.png`), fullPage: true });
      console.log(`  ✓ ${page.name}.png`);
    } catch (e) {
      console.log(`  ✗ ${page.name}: ${e.message}`);
    }
    await p.close();
  }
  
  await browser.close();
  console.log('\nDone! Screenshots saved to:', outputDir);
})();
