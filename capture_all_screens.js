const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getBrowserPath() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(chromePath)) return chromePath;
  if (fs.existsSync(edgePath)) return edgePath;
  throw new Error('Neither Chrome nor Edge executable was found.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('====================================================');
  console.log('Starting Complete System Screenshot Capture Tool');
  console.log('Project: THAI Please WebApp (All Pages & Situations)');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    executablePath: getBrowserPath(),
    headless: true,
    defaultViewport: {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors',
    ],
  });

  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('  [Page Console Error]:', err.message));

  const setDesktop = async () => {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  };

  const setMobile = async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  };

  try {
    // --------------------------------------------------------------------------
    // PART 1: AUTHENTICATION & ACCESS CONTROL FLOW
    // --------------------------------------------------------------------------
    console.log('\n--- PART 1: AUTHENTICATION & ACCESS CONTROL FLOW ---');

    // 01. Home Page (Unauthenticated)
    console.log('01. Capturing Home Page (Unauthenticated)...');
    await setDesktop();
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_home_unauthenticated.png'), fullPage: false });

    // 02. Login Page
    console.log('02. Capturing Login Page (/login)...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_login_page.png'), fullPage: false });

    // 03. Register Page
    console.log('03. Capturing Register Page (/register)...');
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_register_page.png'), fullPage: false });

    // 04. Protected Route Redirect Test
    console.log('04. Capturing Protected Route Redirect (/dashboard -> /login)...');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_protected_route_redirect.png'), fullPage: false });

    // 05. 404 Not Found Page
    console.log('05. Capturing 404 Not Found Page (/not-found-test)...');
    await page.goto('http://localhost:5173/not-found-test', { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_404_not_found.png'), fullPage: false });

    // Set demo authenticated session
    console.log('--> Setting Demo Authenticated Session...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'demo-jwt-token-verified-citizen');
      localStorage.setItem(
        'auth_user',
        JSON.stringify({
          id: '62a51dec-39a0-4193-9ddc-20fe354f0d27',
          email: 'somchai.citizen@thaiplease.go.th',
          name: 'นายสมชาย ประชาชนผู้รับสิทธิ',
          role: 'USER',
          createdAt: new Date().toISOString(),
        })
      );
    });

    // 06. Protected Dashboard Area
    console.log('06. Capturing Dashboard Page (Protected Area Logged In)...');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_dashboard_protected_area.png'), fullPage: false });

    // 07. Home Page (Authenticated)
    console.log('07. Capturing Home Page (Authenticated)...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07_home_authenticated.png'), fullPage: false });

    // --------------------------------------------------------------------------
    // PART 2: CITIZEN FLOW (DEVELOPER 2)
    // --------------------------------------------------------------------------
    console.log('\n--- PART 2: CITIZEN FLOW (WALLET, COPAY, SLIP, TRANSACTIONS) ---');

    // 08. Citizen Wallet Main Page
    console.log('08. Capturing Citizen Wallet Main Page...');
    await page.goto('http://localhost:5173/citizen/wallet', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '08_citizen_wallet_main.png'), fullPage: false });

    // 09. Citizen Wallet Top-up Modal
    console.log('09. Capturing Citizen Wallet Top-up Modal...');
    try {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-open-topup') ||
          Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('เติมเงิน'));
        if (btn) btn.click();
      });
      await sleep(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '09_citizen_wallet_topup_modal.png'), fullPage: false });
    } catch (e) {
      console.warn('Topup modal error:', e.message);
    }

    // 10. Citizen Wallet Top-up Success Message
    console.log('10. Capturing Citizen Wallet Top-up Success Message...');
    try {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-confirm-topup');
        if (btn) btn.click();
      });
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '10_citizen_wallet_topup_success.png'), fullPage: false });
      await sleep(1500);
    } catch (e) {
      console.warn('Topup confirm error:', e.message);
    }

    // 11. Citizen Scan & Pay (Camera View)
    console.log('11. Capturing Citizen Scan & Pay (Camera View)...');
    await page.goto('http://localhost:5173/citizen/scan-copay', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '11_citizen_scan_copay_camera.png'), fullPage: false });

    // 12. Citizen Scan & Pay - Manual QR Input Dropdown
    console.log('12. Capturing Citizen Scan & Pay (Manual QR Input)...');
    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('กรอกรหัส QR')
        );
        if (btn) btn.click();
      });
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '12_citizen_scan_copay_manual_input.png'), fullPage: false });
    } catch (e) {
      console.warn('Manual QR error:', e.message);
    }

    // Generate fresh dynamic QR code via API
    console.log('--> Creating fresh dynamic QR for live preview inspection...');
    const freshQr = await page.evaluate(async () => {
      const res = await fetch('/api/payment/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 250,
          latitude: 13.7500,
          longitude: 100.5000,
          shopName: 'ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)'
        })
      });
      const json = await res.json();
      return json.data;
    });
    console.log('    Fresh QR generated:', freshQr.qrReference);

    // 13. Citizen Co-pay Split Preview (60/40 Calculation & PIN Input)
    console.log('13. Capturing Citizen Co-pay Split Preview with PIN...');
    try {
      await page.type('#input-qr-ref', freshQr.qrReference);
      await page.click('#btn-inspect-qr');
      await sleep(2000);

      // Type PIN
      await page.type('#input-copay-pin', '123456');
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '13_citizen_copay_split_preview.png'), fullPage: false });
    } catch (e) {
      console.warn('Copay preview error:', e.message);
    }

    // 14. Citizen Co-pay Split Preview with Coupon / Friend Referral Applied
    console.log('14. Capturing Citizen Co-pay Preview with Discount Coupon...');
    try {
      await page.evaluate(() => {
        const couponToggle = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('มีคูปองส่วนลด')
        );
        if (couponToggle) couponToggle.click();
      });
      await sleep(600);

      await page.evaluate(() => {
        const friendBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('FRIEND30')
        );
        if (friendBtn) friendBtn.click();
      });
      await sleep(2000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '14_citizen_copay_discount_coupon.png'), fullPage: false });
    } catch (e) {
      console.warn('Coupon apply error:', e.message);
    }

    // 15. Citizen Electronic Slip (Bank-Style e-Slip)
    console.log('15. Capturing Citizen Electronic Slip (Bank-Style e-Slip)...');
    await page.goto('http://localhost:5173/citizen/slip/d504c4c0-bb3a-482c-a810-6dbc2e50925d', { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '15_citizen_bank_slip.png'), fullPage: false });

    // 16. Citizen Slip Auto-Save Permission Request Modal
    console.log('16. Capturing Slip Auto-Save Permission Request Modal...');
    try {
      await page.evaluate(() => {
        localStorage.setItem('thai_please_slip_autosave_permission', 'prompt');
        localStorage.removeItem('thai_please_auto_saved_slips');
      });
      await page.goto('http://localhost:5173/citizen/slip/d504c4c0-bb3a-482c-a810-6dbc2e50925d?autosave=1', { waitUntil: 'networkidle2' });
      await sleep(1200);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '16_citizen_slip_autosave_permission_modal.png'), fullPage: false });
    } catch (e) {
      console.warn('Permission modal error:', e.message);
    }

    // 17. Citizen Slip 24-Hour Merchant Review Modal
    console.log('17. Capturing Citizen Slip Merchant Review Modal...');
    try {
      await page.goto('http://localhost:5173/citizen/slip/d504c4c0-bb3a-482c-a810-6dbc2e50925d', { waitUntil: 'networkidle2' });
      await sleep(1000);
      await page.evaluate(() => {
        const reviewBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('ประเมินร้าน')
        );
        if (reviewBtn) reviewBtn.click();
      });
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '17_citizen_slip_review_modal.png'), fullPage: false });
    } catch (e) {
      console.warn('Review modal error:', e.message);
    }

    // 18. Citizen Transactions Ledger (All)
    console.log('18. Capturing Citizen Transactions Ledger...');
    await page.goto('http://localhost:5173/citizen/transactions', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '18_citizen_transactions_all.png'), fullPage: false });

    // 19. Citizen Transactions Ledger (Flagged Filter)
    console.log('19. Capturing Citizen Transactions (Flagged Filter)...');
    try {
      await page.evaluate(() => {
        const flaggedTab = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('รอตรวจสอบ')
        );
        if (flaggedTab) flaggedTab.click();
      });
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '19_citizen_transactions_flagged_filter.png'), fullPage: false });
    } catch (e) {
      console.warn('Tx filter error:', e.message);
    }

    // --------------------------------------------------------------------------
    // PART 3: MERCHANT FLOW (DEVELOPER 2)
    // --------------------------------------------------------------------------
    console.log('\n--- PART 3: MERCHANT FLOW (POS QR, REAL-TIME ALERT, SALES) ---');

    // 20. Merchant POS Generate QR Initial Screen
    console.log('20. Capturing Merchant POS Generate QR Initial Screen...');
    await page.goto('http://localhost:5173/merchant/pos-qr', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '20_merchant_pos_generate_qr.png'), fullPage: false });

    // 21. Merchant POS QR Active Countdown
    console.log('21. Generating Dynamic QR and Capturing Live Timer Countdown...');
    try {
      await page.evaluate(() => {
        const input = document.getElementById('input-pos-amount');
        if (input) {
          input.value = '250';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const genBtn = document.getElementById('btn-generate-qr');
        if (genBtn) genBtn.click();
      });
      await sleep(2200);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '21_merchant_pos_qr_active.png'), fullPage: false });
    } catch (e) {
      console.warn('Merchant QR gen error:', e.message);
    }

    // 22. Merchant Sales History Dashboard
    console.log('22. Capturing Merchant Sales History & Analytics...');
    await page.goto('http://localhost:5173/merchant/sales', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '22_merchant_sales_history_dashboard.png'), fullPage: false });

    // 23. Merchant Sales History - Flagged / Rejected Filter
    console.log('23. Capturing Merchant Sales History (Flagged Filter)...');
    try {
      await page.evaluate(() => {
        const flaggedTab = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('รอตรวจสอบ')
        );
        if (flaggedTab) flaggedTab.click();
      });
      await sleep(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '23_merchant_sales_flagged_filter.png'), fullPage: false });
    } catch (e) {
      console.warn('Merchant sales filter error:', e.message);
    }

    // --------------------------------------------------------------------------
    // PART 4: ADMIN FLOW (DEVELOPER 2)
    // --------------------------------------------------------------------------
    console.log('\n--- PART 4: ADMIN FLOW (FRAUD ALERTS, LEAFLET OSM MAP, ACTIONS) ---');

    // 24. Admin Fraud Alerts Dashboard
    console.log('24. Capturing Admin Fraud Alerts Dashboard...');
    await page.goto('http://localhost:5173/admin/fraud-alerts', { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '24_admin_fraud_alerts_dashboard.png'), fullPage: false });

    // 25. Admin Fraud Deep-Dive Inspection Modal with OpenStreetMap Leaflet Map
    console.log('25. Opening Fraud Inspection Modal & Leaflet OSM Map...');
    try {
      await page.evaluate(() => {
        const inspectBtn = Array.from(document.querySelectorAll('tbody button')).find(
          (b) => b.textContent && b.textContent.trim() === 'ตรวจสอบ'
        );
        if (inspectBtn) inspectBtn.click();
      });
      // Wait for Leaflet map tiles, circle, and polyline to render
      await sleep(3500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '25_admin_fraud_deep_dive_osm_map.png'), fullPage: false });
    } catch (e) {
      console.warn('Fraud modal error:', e.message);
    }

    // --------------------------------------------------------------------------
    // PART 5: MOBILE RESPONSIVE VIEWPORTS (390 x 844 px)
    // --------------------------------------------------------------------------
    console.log('\n--- PART 5: MOBILE RESPONSIVE VIEWPORTS (THUMB-FRIENDLY UX) ---');
    await setMobile();

    // 26. Mobile Home
    console.log('26. Capturing Mobile Home Page...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '26_mobile_home.png'), fullPage: false });

    // 27. Mobile Citizen Wallet
    console.log('27. Capturing Mobile Citizen Wallet (with Bottom Nav)...');
    await page.goto('http://localhost:5173/citizen/wallet', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '27_mobile_citizen_wallet.png'), fullPage: false });

    // 28. Mobile Citizen Scan & Pay
    console.log('28. Capturing Mobile Citizen Scan & Pay...');
    await page.goto('http://localhost:5173/citizen/scan-copay', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '28_mobile_citizen_scan_copay.png'), fullPage: false });

    // 29. Mobile Citizen e-Slip
    console.log('29. Capturing Mobile Citizen e-Slip...');
    await page.goto('http://localhost:5173/citizen/slip/d504c4c0-bb3a-482c-a810-6dbc2e50925d', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '29_mobile_citizen_slip.png'), fullPage: false });

    // 30. Mobile Merchant POS QR
    console.log('30. Capturing Mobile Merchant POS QR...');
    await page.goto('http://localhost:5173/merchant/pos-qr', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '30_mobile_merchant_pos_qr.png'), fullPage: false });

    // 31. Mobile Admin Fraud Alerts
    console.log('31. Capturing Mobile Admin Fraud Alerts (Card View)...');
    await page.goto('http://localhost:5173/admin/fraud-alerts', { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '31_mobile_admin_fraud_alerts.png'), fullPage: false });

    console.log('\n====================================================');
    console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
    console.log('Saved to:', OUTPUT_DIR);
    console.log('====================================================');
  } catch (err) {
    console.error('Fatal execution error during capture:', err);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
