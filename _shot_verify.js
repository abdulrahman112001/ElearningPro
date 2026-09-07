const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3001", { waitUntil: "networkidle", timeout: 30000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "verify_top.png" });
  await page.evaluate(() => window.scrollTo(0, 950));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "verify_courses.png" });
  await page.evaluate(() => window.scrollTo(0, 1750));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "verify_instructors.png" });
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error(e); process.exit(1); });
