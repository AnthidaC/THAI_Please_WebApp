const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, 'screenshots');
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.VITE_API_URL || 'http://localhost:5000/api';
const demoAccountIds = {
  CITIZEN: process.env.VITE_DEMO_CITIZEN_USER_ID,
  MERCHANT: process.env.VITE_DEMO_MERCHANT_ID,
  ADMIN: process.env.VITE_DEMO_ADMIN_STAFF_ID,
};

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function setDemoSession(page, role) {
  const accountId = demoAccountIds[role];
  const response = await fetch(`${API_URL}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, ...(accountId ? { accountId } : {}) }),
  });
  if (!response.ok) {
    throw new Error(`Mock ${role} login failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, result.data);
}

async function run() {
  console.log('Starting enhanced screenshot capture...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2, // HiDPI crisp screenshots
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();

  // Handle uncaught page errors gracefully
  page.on('pageerror', (err) => console.log('Page error:', err.message));

  // Initialize a server-issued Citizen session for a DB-marked test account.
  await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' });
  await setDemoSession(page, 'CITIZEN');

  // 1. Citizen Wallet Page
  console.log('1. Capturing Citizen Wallet...');
  await page.goto(`${APP_URL}/citizen/wallet`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_citizen_wallet.png'), fullPage: false });

  // 2. Citizen Wallet Top-up Modal
  console.log('2. Capturing Citizen Wallet Top-up Modal...');
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const topUpBtn = btns.find((b) => b.textContent && (b.textContent.includes('เติมเงิน') || b.textContent.includes('Top-up')));
      if (topUpBtn) topUpBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_citizen_wallet_topup_modal.png'), fullPage: false });

    // Close modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find((b) => b.textContent && b.textContent.includes('ยกเลิก'));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  } catch (err) {
    console.error('Error capturing top-up modal:', err.message);
  }

  // 3. Citizen Transactions Ledger
  console.log('3. Capturing Citizen Transactions Ledger...');
  await page.goto(`${APP_URL}/citizen/transactions`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_citizen_transactions_ledger.png'), fullPage: false });

  // 4. Citizen Scan & Pay (Camera View)
  console.log('4. Capturing Citizen Scan & Pay Page...');
  await page.goto(`${APP_URL}/citizen/scan-copay`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_citizen_scan_copay.png'), fullPage: false });

  // 5. Citizen Electronic Slip
  console.log('5. Capturing Citizen e-Slip...');
  await page.goto(`${APP_URL}/citizen/slip/d504c4c0-bb3a-482c-a810-6dbc2e50925d`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_citizen_slip.png'), fullPage: false });

  // 6. Merchant POS QR Initial Screen
  console.log('6. Capturing Merchant POS QR Initial Screen...');
  await setDemoSession(page, 'MERCHANT');
  await page.goto(`${APP_URL}/merchant/pos-qr`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_merchant_pos_generate_qr.png'), fullPage: false });

  // 7. Merchant POS QR Active Countdown
  console.log('7. Generating QR Code and Capturing Live Timer Countdown...');
  let generatedQrRef = null;
  try {
    generatedQrRef = await page.evaluate(async () => {
      const input = document.querySelector('input[type="number"]') || document.querySelector('input');
      if (input) {
        input.value = '250';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find((b) => b.textContent && (b.textContent.includes('สร้าง QR') || b.textContent.includes('สร้างคิวอาร์')));
      if (genBtn) genBtn.click();
    });

    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07_merchant_pos_qr_active.png'), fullPage: false });
  } catch (err) {
    console.error('Error generating QR:', err.message);
  }

  // 8. Citizen Scan & Preview Co-pay Split (with 60/40 calculation & PIN input)
  console.log('8. Capturing Citizen Co-pay Split Preview with 6-digit PIN...');
  try {
    await setDemoSession(page, 'CITIZEN');
    await page.goto(`${APP_URL}/citizen/scan-copay`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Open manual input and enter QR reference
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const manualBtn = btns.find((b) => b.textContent && b.textContent.includes('กรอกรหัส QR'));
      if (manualBtn) manualBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Set QR reference and click inspect
    await page.evaluate(() => {
      const input = document.getElementById('input-qr-ref') || document.querySelector('input[placeholder*="รหัส QR"]');
      if (input) {
        input.value = 'TP-QR-SUSP-002';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inspectBtn = document.getElementById('btn-inspect-qr') || Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('ตรวจ'));
      if (inspectBtn) inspectBtn.click();
    });

    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04b_citizen_copay_split_preview.png'), fullPage: false });
  } catch (err) {
    console.error('Error capturing copay preview:', err.message);
  }

  // 9. Merchant Sales History
  console.log('9. Capturing Merchant Sales History...');
  await setDemoSession(page, 'MERCHANT');
  await page.goto(`${APP_URL}/merchant/sales`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_merchant_sales_history.png'), fullPage: false });

  // 10. Admin Fraud Alerts Dashboard
  console.log('10. Capturing Admin Fraud Alerts Dashboard...');
  await setDemoSession(page, 'ADMIN');
  await page.goto(`${APP_URL}/admin/fraud-alerts`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '09_admin_fraud_alerts_dashboard.png'), fullPage: false });

  // 11. Admin Fraud Inspection with Real OpenStreetMap Leaflet Map
  console.log('11. Opening Fraud Inspection Modal & Leaflet Map...');
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const inspectBtn = btns.find((b) => b.textContent && (b.textContent.includes('ตรวจสอบ') || b.textContent.includes('พิกัด')));
      if (inspectBtn) inspectBtn.click();
    });

    // Wait for Leaflet map tiles, circle, and polyline to render
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '10_admin_fraud_deep_dive_osm_map.png'), fullPage: false });
  } catch (err) {
    console.error('Error clicking inspect button:', err.message);
  }

  await browser.close();
  console.log('All screenshots captured successfully in:', OUTPUT_DIR);
}

run().catch(console.error);
