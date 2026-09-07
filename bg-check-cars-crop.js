const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:5173";
const SCRATCH = "C:/Users/hp/AppData/Local/Temp/claude/d--my-work-cars/83615d83-2a17-4c85-942d-5ce72eaa72a4/scratchpad";
const storagePath = path.join(SCRATCH, "storage.json");

(async () => {
  const browser = await chromium.launch();

  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storagePath });
  const page1 = await context1.newPage();
  await page1.goto(BASE + "/dashboard");
  await page1.waitForSelector("text=لوحة التحكم");
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(SCRATCH, "crop_900_topright.png"), clip: { x: 1100, y: 0, width: 340, height: 400 } });
  await page1.screenshot({ path: path.join(SCRATCH, "crop_900_full_sidebar.png"), clip: { x: 1100, y: 0, width: 340, height: 900 } });
  await context1.close();

  const context2 = await browser.newContext({ viewport: { width: 1440, height: 2200 }, storageState: storagePath });
  const page2 = await context2.newPage();
  await page2.goto(BASE + "/dashboard");
  await page2.waitForSelector("text=لوحة التحكم");
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(SCRATCH, "crop_2200_topright.png"), clip: { x: 1100, y: 0, width: 340, height: 400 } });
  await page2.screenshot({ path: path.join(SCRATCH, "crop_2200_full_sidebar.png"), clip: { x: 1100, y: 0, width: 340, height: 2200 } });
  await context2.close();

  await browser.close();
  console.log("done");
})();
