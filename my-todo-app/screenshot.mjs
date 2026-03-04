import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../docs/screenshots');
const BASE = 'http://localhost:8081';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function shot(name, fn) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await fn(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}.png`);
}

// Todos tab (default)
await shot('todos', async (p) => {});

// Deadlines tab
await shot('deadlines', async (p) => {
  await p.getByText('Deadlines').click();
  await p.waitForTimeout(1000);
});

// Board tab (default theme)
await shot('board', async (p) => {
  await p.getByText('Board').click();
  await p.waitForTimeout(1500);
});

// Board with Zootopia theme — set via AsyncStorage then reload
await shot('zootopia', async (p) => {
  // Set theme in AsyncStorage directly
  await p.evaluate(() => {
    localStorage.setItem('EXPO_ASYNC_STORAGE_app_theme', JSON.stringify('zootopia'));
    // AsyncStorage on web uses localStorage with different key format; try both
    window.localStorage.setItem('app_theme', 'zootopia');
  });
  await p.getByText('Board').click();
  await p.waitForTimeout(500);
  // Force click the 🎨 button
  await p.getByText('🎨').first().click({ force: true });
  await p.waitForTimeout(400);
  await p.getByText('Zootopia').click({ force: true });
  await p.waitForTimeout(1500);
});

// Confetti — drag a card to Done
await shot('confetti', async (p) => {
  await p.getByText('Board').click();
  await p.waitForTimeout(1500);
  const backlogHeader = p.locator('text=BACKLOG').first();
  const doneHeader = p.locator('text=DONE').first();
  const bBox = await backlogHeader.boundingBox();
  const dBox = await doneHeader.boundingBox();
  if (bBox && dBox) {
    await p.mouse.move(bBox.x + bBox.width / 2, bBox.y + 80);
    await p.mouse.down();
    await p.waitForTimeout(500);
    await p.mouse.move(dBox.x + dBox.width / 2, dBox.y + 80, { steps: 40 });
    await p.waitForTimeout(500);
    await p.mouse.up();
    await p.waitForTimeout(2500);
  }
});

// Reset theme to default after
await page.evaluate(() => { window.localStorage.removeItem('app_theme'); });

await browser.close();
console.log('Done!');
