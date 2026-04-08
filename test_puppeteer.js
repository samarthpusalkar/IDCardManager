import puppeteer from 'puppeteer-core';
try {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: "new"
  });
  console.log("Puppeteer works");
  await browser.close();
} catch (e) {
  console.error("Puppeteer failed", e);
}
