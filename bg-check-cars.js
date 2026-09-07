const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:5173";
const SCRATCH = "C:\\Users\\hp\\AppData\\Local\\Temp\\claude\\d--my-work-cars\\83615d83-2a17-4c85-942d-5ce72eaa72a4\\scratchpad";

async function login(page) {
  await page.goto(BASE + "/login");
  await page.waitForSelector("text=admin@cars.test");
  await page.click("text=admin@cars.test");
  await page.click('button[type=submit]');
  await page.waitForSelector("text=لوحة التحكم");
  await page.waitForTimeout(1000);
}

(async () => {
  const errors1 = [];
  const errors2 = [];

  const browser = await chromium.launch();

  // Context 1: 1440x900
  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1 = await context1.newPage();
  page1.on("console", (msg) => { if (msg.type() === "error") errors1.push(msg.text()); });
  page1.on("pageerror", (err) => errors1.push(String(err)));

  await login(page1);

  const bgStyles1 = await page1.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      backgroundRepeat: cs.backgroundRepeat,
      backgroundColor: cs.backgroundColor,
      backgroundAttachment: cs.backgroundAttachment,
    };
  });

  const shot1Path = path.join(SCRATCH, "shot_1440x900.png");
  await page1.screenshot({ path: shot1Path, fullPage: false });

  // save storage state for reuse
  const storagePath = path.join(SCRATCH, "storage.json");
  await context1.storageState({ path: storagePath });

  await context1.close();

  // Context 2: 1440x2200
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 2200 }, storageState: storagePath });
  const page2 = await context2.newPage();
  page2.on("console", (msg) => { if (msg.type() === "error") errors2.push(msg.text()); });
  page2.on("pageerror", (err) => errors2.push(String(err)));

  await page2.goto(BASE + "/dashboard");
  // in case redirected to login (storage state not effective), handle gracefully
  const isLogin = await page2.locator("text=admin@cars.test").count();
  if (isLogin > 0) {
    await login(page2);
  } else {
    await page2.waitForSelector("text=لوحة التحكم");
    await page2.waitForTimeout(1000);
  }

  const bgStyles2 = await page2.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      backgroundRepeat: cs.backgroundRepeat,
      backgroundColor: cs.backgroundColor,
      backgroundAttachment: cs.backgroundAttachment,
    };
  });

  const shot2Path = path.join(SCRATCH, "shot_1440x2200.png");
  await page2.screenshot({ path: shot2Path, fullPage: false });

  await context2.close();
  await browser.close();

  console.log("=== CONTEXT 1 (1440x900) computed body background ===");
  console.log(JSON.stringify(bgStyles1, null, 2));
  console.log("Errors (context1):", errors1);
  console.log("Screenshot 1:", shot1Path);

  console.log("=== CONTEXT 2 (1440x2200) computed body background ===");
  console.log(JSON.stringify(bgStyles2, null, 2));
  console.log("Errors (context2):", errors2);
  console.log("Screenshot 2:", shot2Path);
})();
