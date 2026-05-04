const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/');
  
  // Fill text inputs
  await page.fill('#brand-name', 'OakTen');
  await page.fill('#audit-asin', 'B0DD2XC38R');
  
  // The inputs are inside .upload-zone elements
  const fileInputs = await page.$$('.upload-zone input[type="file"]');
  
  await fileInputs[0].setInputFiles('c:/Users/ST/Downloads/assessmentforaioperationsassociatembg/OakTen All product.csv');
  await fileInputs[1].setInputFiles('c:/Users/ST/Downloads/assessmentforaioperationsassociatembg/B0DD2XC38R Jungle scout data.csv');
  await fileInputs[2].setInputFiles('c:/Users/ST/Downloads/assessmentforaioperationsassociatembg/US_AMAZON_cerebro_B0DD2XC38R_2026-03-27.csv');
  await fileInputs[3].setInputFiles('c:/Users/ST/Downloads/assessmentforaioperationsassociatembg/Title & Bullets (All 4 ASINs).xlsx');
  
  await page.screenshot({ path: 'c:/Users/ST/Desktop/BGC_Task/screenshot_form_filled.png' });
  
  // Click process
  await page.click('#process-btn');
  
  // Wait for the report section to appear
  await page.waitForSelector('.report-section', { timeout: 30000 });
  await page.screenshot({ path: 'c:/Users/ST/Desktop/BGC_Task/screenshot_report_keywords.png', fullPage: true });
  
  // Click other tabs
  const tabs = await page.$$('.tab-btn');
  if (tabs.length > 1) {
    await tabs[1].click(); // Current Listing
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'c:/Users/ST/Desktop/BGC_Task/screenshot_report_current.png', fullPage: true });
    
    await tabs[2].click(); // Optimized Listing
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'c:/Users/ST/Desktop/BGC_Task/screenshot_report_optimized.png', fullPage: true });
  }
  
  await browser.close();
  console.log('Screenshots taken successfully.');
})();
