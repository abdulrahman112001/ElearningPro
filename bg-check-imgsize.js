const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dims = await page.evaluate(async () => {
    const img = new Image();
    const p = new Promise((res, rej) => {
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = rej;
    });
    img.src = "http://localhost:5173/src/Assets/images/image.png";
    return p;
  });
  console.log(JSON.stringify(dims));
  await browser.close();
})();
