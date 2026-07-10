import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 820, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.home-screen');
  await page.locator('.primary-button').click();
  await page.waitForSelector('.phaser-root canvas', { timeout: 10_000 });
  const canvas = await page.$eval('.phaser-root canvas', (element) => ({ width: element.width, height: element.height }));
  if (canvas.width !== 420 || canvas.height !== 760) throw new Error(`Unexpected canvas size: ${canvas.width}x${canvas.height}`);
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log('Smoke test passed: home rendered, round started, Phaser canvas mounted.');
} finally {
  await browser.close();
}
