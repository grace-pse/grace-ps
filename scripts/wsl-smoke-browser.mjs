// End-to-end browser test with Puppeteer driving the real Vite dev server.
// 1. open login page
// 2. fill email+password+org slug, submit
// 3. navigate to assessment wizard
// 4. click "Download PDF report"
// 5. verify PDF was downloaded via CDP request interception

import puppeteer from '/root/csmp_v2/server/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { writeFileSync, statSync } from 'node:fs';

const CLIENT = 'http://127.0.0.1:5173';
const EMAIL = 'lead@block-b.test';
const PASS = 'password123!';
const SLUG = 'block-b-smoke';
const ASSESSMENT_ID = '8aab1987-e91d-4589-9dab-d59a44fdf1f6';
const OUT_PDF = '/tmp/browser-download.pdf';

console.log('>> launch chromium');
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('   [page]', m.type(), m.text().slice(0, 160)));
  page.on('pageerror', (e) => console.log('   [page-error]', e.message));

  // Intercept the /report.pdf response to capture the downloaded bytes.
  let pdfBuffer = null;
  let pdfStatus = null;
  let pdfContentType = null;
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.endsWith('/report.pdf')) {
      pdfStatus = resp.status();
      pdfContentType = resp.headers()['content-type'];
      try { pdfBuffer = await resp.buffer(); } catch (e) { console.log('   [resp-buf-err]', e.message); }
      console.log('   [pdf-response]', pdfStatus, pdfContentType, pdfBuffer?.length);
    }
  });

  console.log('>> navigate to login');
  await page.goto(`${CLIENT}/login`, { waitUntil: 'networkidle2', timeout: 15_000 });
  console.log('   url:', page.url());

  console.log('>> fill login form');
  await page.waitForSelector('input[type=email]', { timeout: 10_000 });
  // Order in the login form: slug (text/acme-corp), email, password.
  await page.type('input[placeholder="acme-corp"]', SLUG);
  await page.type('input[type=email]', EMAIL);
  await page.type('input[type=password]', PASS);
  console.log('   filled slug+email+password');

  console.log('>> submit');
  await page.click('button[type=submit]');
  // SPA: wait for URL to leave /login
  for (let i = 0; i < 30 && /\/login/.test(page.url()); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('   post-login url:', page.url());
  if (/\/login/.test(page.url())) {
    const err = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('   ❌ still on /login; body:\n', err);
    process.exit(5);
  }

  console.log(`>> navigate to assessment ${ASSESSMENT_ID}`);
  await page.goto(`${CLIENT}/assessments/${ASSESSMENT_ID}`, { waitUntil: 'networkidle2', timeout: 15_000 });
  console.log('   url:', page.url());

  // Give the wizard a moment to render the approved banner + button
  await new Promise((r) => setTimeout(r, 1500));

  console.log('>> find and click Download PDF button');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => /download pdf/i.test(b.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) {
    console.log('   ❌ download button not found; dumping page text sample');
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log('   body text:', txt);
    process.exit(2);
  }
  console.log('   ✅ button clicked, waiting for response');

  // Wait up to 20 s for the PDF response to land
  for (let i = 0; i < 40 && !pdfBuffer; i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!pdfBuffer) {
    console.log('   ❌ no PDF response observed');
    process.exit(3);
  }

  writeFileSync(OUT_PDF, pdfBuffer);
  const sz = statSync(OUT_PDF).size;
  const magic = pdfBuffer.subarray(0, 5).toString();
  console.log(`>> wrote ${OUT_PDF}  size=${sz}  magic=${JSON.stringify(magic)}`);
  if (magic !== '%PDF-') {
    console.log('   ❌ not a PDF');
    process.exit(4);
  }
  console.log('✅ browser end-to-end PASS: button click → PDF bytes downloaded & valid');
} finally {
  await browser.close();
}
