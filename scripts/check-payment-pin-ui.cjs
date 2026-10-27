const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const puppeteer = require('puppeteer-core');
const { spawn } = require('node:child_process');

async function main() {
  const browserPath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const base = process.env.PIN_UI_URL || 'http://127.0.0.1:5176';
  const screenshots = path.join(os.tmpdir(), 'thai-please-pin-ui');
  fs.mkdirSync(screenshots, { recursive: true });
  let browser;
  let vite;
  try {
    if (!process.env.PIN_UI_URL) {
      vite = spawn(process.execPath, [path.resolve(__dirname, '../client/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5176', '--strictPort'], {
        cwd: path.resolve(__dirname, '../client'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Vite startup timed out')), 30000);
        vite.stdout.on('data', data => { if (data.toString().includes('Local:')) { clearTimeout(timer); resolve(); } });
        vite.once('error', error => { clearTimeout(timer); reject(error); });
        vite.once('exit', code => { clearTimeout(timer); reject(new Error(`Vite exited: ${code}`)); });
      });
    }
    browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', name: 'PIN UI Test', role: 'USER' };
    const token = `ui.${Buffer.from(JSON.stringify({ userId: user.id, role: 'CITIZEN' })).toString('base64url')}.mock`;
    const configured = new Set();
    let failFirstSave = true;
    let saves = 0;
    let paymentAttempts = 0;
    let allowPayment = false;
    const transactionId = '11111111-2222-4333-8444-555555555555';
    const payment = { transactionId, qrReference: 'QR-UI-TEST', customerName: 'PIN UI Test', shopName: 'UI Test Shop',
      totalAmount: 200, governmentCopayAmount: 120, citizenPaidAmount: 80, status: 'SUCCESS', timestamp: new Date().toISOString(),
      merchantTaxId: '0105564000123', slipId: 'SLIP-UI-TEST', copayRatio: '60/40',
      securityVerification: { isGpsVerified: true, distanceMeters: 10, riskScore: 0.06, decision: 'AUTO_APPROVED' } };
    await page.evaluateOnNewDocument((sessionUser, sessionToken) => {
      localStorage.setItem('auth_user', JSON.stringify(sessionUser));
      localStorage.setItem('auth_token', sessionToken);
    }, user, token);
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return url.origin === new URL(base).origin ? request.continue() : request.abort();
      const bearer = request.headers().authorization;
      let status = 200;
      let body = { status: 'success', data: [] };
      if (url.pathname.endsWith('/wallet/pin/status')) {
        body.data = { isSet: configured.has(bearer), lockedUntil: null };
      } else if (url.pathname.endsWith('/wallet/pin') && request.method() === 'PUT') {
        const payload = JSON.parse(request.postData());
        assert.equal(payload.pin, payload.confirmPin);
        saves++;
        if (failFirstSave) {
          failFirstSave = false;
          status = 503;
          body = { status: 'error', message: 'บันทึก PIN ไม่สำเร็จ กรุณาลองใหม่' };
        } else {
          configured.add(bearer);
          body.data = { isSet: true };
        }
      } else if (url.pathname.endsWith('/wallet/balance')) {
        body.data = { balance: 1000, eligibilityStatus: 'ELIGIBLE', dailyQuotaRemaining: 150 };
      } else if (url.pathname.endsWith('/payment/qr/QR-UI-TEST')) {
        body.data = { qrData: { qrReference: 'QR-UI-TEST', merchantId: 'shop', shopName: 'UI Test Shop', totalAmount: 200,
          estimatedGovCopay: 120, estimatedCitizenPay: 80, expiresAt: new Date(Date.now() + 180000).toISOString() },
          copaySplit: { totalAmount: 200, governmentCopayAmount: 120, citizenPaidAmount: 80,
            governmentPercentage: 60, citizenPercentage: 40, totalSavingsAmount: 120 } };
      } else if (url.pathname.endsWith('/payment/qr/checkout') && request.method() === 'POST') {
        paymentAttempts++;
        if (allowPayment) { await new Promise(resolve => setTimeout(resolve, 1500)); body.data = payment; }
        else { status = 400; body = { status: 'error', code: 'PIN_INCORRECT', message: 'รหัส PIN ไม่ถูกต้อง เหลืออีก 4 ครั้ง' }; }
      } else if (url.pathname.endsWith(`/transactions/${transactionId}/slip`)) {
        body.data = payment;
      }
      return request.respond({ status, contentType: 'application/json', headers: {
        'Access-Control-Allow-Origin': new URL(base).origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      }, body: JSON.stringify(body) });
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dialog[open]');
    await page.waitForSelector('dialog input[aria-label="PIN ใหม่ (6 หลัก)"]');
    assert.equal(await page.$eval('dialog', element => element.getAttribute('aria-labelledby')), 'payment-pin-gate-title');
    await page.keyboard.press('Escape');
    assert.ok(await page.$('dialog[open]'), 'Escape must not bypass required setup');
    await page.screenshot({ path: path.join(screenshots, 'desktop.png') });
    await page.setViewport({ width: 390, height: 844 });
    const box = await page.$eval('dialog', element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, height: rect.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    });
    assert.ok(box.left >= 0 && box.right <= 390 && box.height <= 844);
    assert.ok(box.scrollWidth <= box.clientWidth, 'Modal must not overflow horizontally');
    await page.screenshot({ path: path.join(screenshots, 'mobile.png') });
    await page.type('dialog input[aria-label="PIN ใหม่ (6 หลัก)"]', '123456');
    await page.type('dialog input[aria-label="ยืนยัน PIN ใหม่"]', '654321');
    assert.equal(await page.$eval('dialog button[type="submit"]', element => element.disabled), true);
    await page.$eval('dialog input[aria-label="ยืนยัน PIN ใหม่"]', element => { element.focus(); element.select(); });
    await page.keyboard.type('123456');
    await page.click('dialog button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('dialog [role="alert"]')?.textContent.includes('ลองใหม่'));
    assert.ok(await page.$('dialog[open]'), 'Save failure must keep the setup dialog open');
    await page.click('dialog button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(saves, 2);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    // Trigger a session change in-place to verify per-account query isolation.
    await page.evaluate(async () => {
      const { useAuthStore } = await import('/src/stores/authStore.ts');
      const second = { id: '22222222-2222-4222-8222-222222222222', role: 'USER', name: 'Second' };
      const sessionToken = 'ui.' + btoa(JSON.stringify({ userId: second.id, role: 'CITIZEN' })) + '.mock';
      useAuthStore.getState().setAuth(second, sessionToken);
    });
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('dialog input[aria-label="PIN ใหม่ (6 หลัก)"]', element => element.value), '');
    await page.evaluate(async () => {
      const { useAuthStore } = await import('/src/stores/authStore.ts');
      useAuthStore.getState().setAuth({ id: 'merchant', role: 'MERCHANT' }, 'ui.' + btoa(JSON.stringify({ role: 'MERCHANT' })) + '.mock');
    });
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.evaluate(async (sessionUser, sessionToken) => {
      const { useAuthStore } = await import('/src/stores/authStore.ts');
      useAuthStore.getState().setAuth(sessionUser, sessionToken);
      localStorage.setItem('thai_please_slip_autosave_permission', 'denied');
      history.pushState({}, '', '/citizen/scan-copay'); window.dispatchEvent(new PopStateEvent('popstate'));
    }, user, token);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('กรอกรหัส QR ด้วยตนเอง')));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('กรอกรหัส QR ด้วยตนเอง')).click());
    await page.type('#input-qr-ref', 'QR-UI-TEST');
    await page.$eval('#btn-inspect-qr', button => button.click());
    await page.waitForSelector('#btn-confirm-checkout');
    assert.equal(await page.$('#input-copay-pin'), null, 'Review must not contain the PIN input');
    const openPaymentPin = async () => {
      await page.waitForFunction(() => !document.querySelector('#btn-confirm-checkout').disabled);
      await page.$eval('#btn-confirm-checkout', button => button.click());
      await page.waitForSelector('#payment-pin-confirmation[open]');
    };
    const enterPaymentPin = async digits => { for (const digit of digits) await page.click(`[data-pin-digit="${digit}"]`); };
    await openPaymentPin();
    assert.equal(paymentAttempts, 0);
    await enterPaymentPin('123'); assert.equal(paymentAttempts, 0);
    await page.click('[aria-label="กลับไปตรวจสอบยอดชำระ"]');
    await page.waitForFunction(() => !document.querySelector('#payment-pin-confirmation[open]'));
    assert.equal(paymentAttempts, 0, 'Cancel must not submit a payment');
    await openPaymentPin();
    assert.equal(await page.$eval('#payment-pin-confirmation [role="status"]', element => element.getAttribute('aria-label')), 'กรอกรหัสแล้ว 0 จาก 6 หลัก');
    await enterPaymentPin('123456');
    await page.waitForFunction(() => document.querySelector('#payment-pin-confirmation [role="alert"]')?.textContent.includes('ไม่ถูกต้อง'));
    assert.equal(paymentAttempts, 1);
    allowPayment = true; await enterPaymentPin('123456');
    await page.waitForFunction(() => document.querySelector('#payment-pin-confirmation').innerText.includes('กำลังยืนยันการชำระเงิน'));
    assert.equal(await page.$eval('[data-pin-digit="1"]', element => element.disabled), true);
    await page.keyboard.type('123456');
    assert.equal(paymentAttempts, 2, 'Pending authorization must not submit a second request');
    await page.waitForFunction(() => location.pathname.includes('/citizen/slip/'));
    assert.deepEqual(errors, []);
    console.log('PASS: automatic first-session setup, required confirmation, retry, close after save, mobile layout and account isolation');
    console.log('PASS: review then full-screen PIN, no payment before six digits, cancel, error retry, pending request protection and success');
    console.log(`Screenshots: ${screenshots}`);
  } finally { if (browser) await browser.close(); if (vite) vite.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
