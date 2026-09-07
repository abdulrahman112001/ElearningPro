const { chromium } = require("playwright");
const path = require("path");
const SCRATCH = "C:/Users/hp/AppData/Local/Temp/claude/d--my-work-cars/83615d83-2a17-4c85-942d-5ce72eaa72a4/scratchpad";
const storagePath = path.join(SCRATCH, "storage.json");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 2200 }, storageState: storagePath });
  const page = await context.newPage();
  await page.goto("http://localhost:5173/dashboard");
  await page.waitForSelector("text=لوحة التحكم");
  await page.waitForTimeout(500);
  // right edge strip, full height, wide enough to see the letterbox-to-image seam
  await page.screenshot({ path: path.join(SCRATCH, "edge_right_2200.png"), clip: { x: 1350, y: 0, width: 90, height: 2200 } });
  // sample pixel colors at various x to find the image/letterbox boundary
  const samples = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1440; canvas.height = 5;
    const ctx = canvas.getContext('2d');
    ctx.drawWindow ? null : null;
    return null;
  });
  await context.close();
  await browser.close();
  console.log('done');
})();
