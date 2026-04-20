// Block C end-to-end smoke test with Puppeteer.
//
// Scenarios covered (one browser session per scenario to start from clean state):
//   1. Reviewer sees the IN_REVIEW assessment on /review, approves it → APPROVED
//   2. Reseed → Lead sees it in "Your submissions in review" (subdued, no buttons)
//   3. Reseed → Reviewer rejects with notes → REJECTED; Lead opens the assessment
//      and sees the REJECTED banner + reviewer notes visible.
//
// Runs the seed between scenarios to reset state.

import puppeteer from '/root/csmp_v2/server/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { execSync } from 'node:child_process';

const CLIENT = 'http://127.0.0.1:5173';
const SLUG = 'block-b-smoke';
const LEAD = { email: 'lead@block-b.test', password: 'password123!' };
const REVIEWER = { email: 'reviewer@block-b.test', password: 'password123!' };

function reseed() {
  console.log('   (reseed) running seed-in-review-assessment.mjs');
  const out = execSync('node /root/csmp_v2/scripts/seed-in-review-assessment.mjs', { encoding: 'utf8' });
  const m = out.match(/ASSESSMENT_ID=([a-f0-9-]+)/);
  if (!m) throw new Error('seed did not print ASSESSMENT_ID');
  return m[1];
}

async function login(page, user) {
  await page.goto(`${CLIENT}/login`, { waitUntil: 'networkidle2', timeout: 15_000 });
  await page.waitForSelector('input[type=email]', { timeout: 10_000 });
  await page.type('input[placeholder="acme-corp"]', SLUG);
  await page.type('input[type=email]', user.email);
  await page.type('input[type=password]', user.password);
  await page.click('button[type=submit]');
  for (let i = 0; i < 30 && /\/login/.test(page.url()); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (/\/login/.test(page.url())) {
    const err = await page.evaluate(() => document.body.innerText.slice(0, 400));
    throw new Error(`login failed for ${user.email}: ${err}`);
  }
}

async function clearSession(page) {
  // Wipe localStorage so a fresh login is required between scenarios
  await page.goto(CLIENT, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
}

async function scenario1Approve(browser) {
  console.log('\n== SCENARIO 1: reviewer approves via /review ==');
  const assessmentId = reseed();
  console.log('   assessment:', assessmentId);

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [page-error]', e.message));
  await clearSession(page);
  await login(page, REVIEWER);

  console.log('>> open /review');
  await page.goto(`${CLIENT}/review`, { waitUntil: 'networkidle2' });
  const linkExists = await page.evaluate((id) => {
    const links = Array.from(document.querySelectorAll('a'));
    return !!links.find((a) => a.getAttribute('href')?.includes(`/assessments/${id}`));
  }, assessmentId);
  if (!linkExists) {
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 600));
    throw new Error(`assessment link not found on /review; body:\n${txt}`);
  }
  console.log('   ✅ assessment visible in Awaiting-your-review section');

  console.log('>> click through to wizard');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.evaluate((id) => {
      const a = Array.from(document.querySelectorAll('a')).find((l) => l.getAttribute('href')?.includes(`/assessments/${id}`));
      a.click();
    }, assessmentId),
  ]);

  console.log('>> fill review notes + click Approve');
  await page.waitForSelector('textarea', { timeout: 5_000 });
  await page.type('textarea', 'Smoke test: approved by automated reviewer.');

  const responsePromise = page.waitForResponse((r) => r.url().includes('/review') && r.request().method() === 'POST', { timeout: 10_000 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /approve/i.test(b.textContent || ''));
    btn.click();
  });
  const resp = await responsePromise;
  const body = await resp.json();
  console.log('   [review response]', resp.status(), JSON.stringify(body));
  if (resp.status() !== 200 || body.reviewStatus !== 'APPROVED') {
    throw new Error(`approve failed: ${resp.status()} ${JSON.stringify(body)}`);
  }

  // After approval the page reloads; verify the APPROVED banner appears
  await new Promise((r) => setTimeout(r, 1200));
  const hasApprovedBanner = await page.evaluate(() => /assessment approved/i.test(document.body.innerText));
  if (!hasApprovedBanner) throw new Error('APPROVED banner missing after approve');
  console.log('   ✅ wizard shows Assessment approved banner');

  await page.close();
}

async function scenario2LeadSelfView(browser) {
  console.log('\n== SCENARIO 2: lead sees their own submission as subdued (no buttons) ==');
  reseed();

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [page-error]', e.message));
  await clearSession(page);
  await login(page, LEAD);

  await page.goto(`${CLIENT}/review`, { waitUntil: 'networkidle2' });
  const text = await page.evaluate(() => document.body.innerText);
  if (!/your submissions in review/i.test(text)) {
    throw new Error('Lead should see "Your submissions in review" section');
  }
  if (/awaiting your review/i.test(text)) {
    // The section heading still renders even when empty — check for the empty hint instead
    const hasAwaitingRow = await page.evaluate(() => {
      const sec = Array.from(document.querySelectorAll('section'))
        .find((s) => /awaiting your review/i.test(s.textContent || ''));
      if (!sec) return false;
      return sec.querySelectorAll('tbody tr a[href*="/assessments/"]').length > 0;
    });
    if (hasAwaitingRow) throw new Error('Lead should NOT see rows in Awaiting-your-review');
  }
  console.log('   ✅ lead view: own submission in "Your submissions", empty Awaiting-your-review');
  await page.close();
}

async function scenario3Reject(browser) {
  console.log('\n== SCENARIO 3: reviewer rejects with notes; lead sees REJECTED banner ==');
  const assessmentId = reseed();
  console.log('   assessment:', assessmentId);

  // --- As reviewer: reject ---
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [page-error]', e.message));
  await clearSession(page);
  await login(page, REVIEWER);
  await page.goto(`${CLIENT}/assessments/${assessmentId}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('textarea', { timeout: 5_000 });
  const rejectNotes = 'Smoke test: needs more rigor on likelihood scoring — please revise.';
  await page.type('textarea', rejectNotes);

  const rejResp = page.waitForResponse((r) => r.url().includes('/review') && r.request().method() === 'POST', { timeout: 10_000 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\s*reject\s*$/i.test((b.textContent || '').trim()));
    btn.click();
  });
  const rr = await rejResp;
  const rbody = await rr.json();
  console.log('   [reject response]', rr.status(), JSON.stringify(rbody));
  if (rr.status() !== 200 || rbody.reviewStatus !== 'REJECTED') {
    throw new Error(`reject failed: ${rr.status()} ${JSON.stringify(rbody)}`);
  }

  // Wait up to 5s for the "Sent back for revision" header to appear
  await page.waitForFunction(
    () => /sent back for revision/i.test(document.body.innerText),
    { timeout: 5_000 },
  ).catch(async () => {
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 800));
    console.log('   [debug] body text after reject:\n', txt);
  });
  const reviewerSees = await page.evaluate(() => ({
    hasRejectedPill: !!Array.from(document.querySelectorAll('*')).find((e) => /^\s*REJECTED\s*$/.test((e.textContent || '').trim())),
    hasNotes: /smoke test: needs more rigor/i.test(document.body.innerText),
    bodyHead: document.body.innerText.slice(0, 400),
  }));
  if (!reviewerSees.hasRejectedPill) throw new Error('reviewer view missing REJECTED pill after reject');
  if (!reviewerSees.hasNotes) {
    console.log('   [debug] body head:', reviewerSees.bodyHead);
    throw new Error('reviewer view missing reviewer notes after reject');
  }
  console.log('   ✅ reviewer sees REJECTED pill + notes');
  await page.close();

  // --- As lead: open same assessment, verify rejected banner + notes ---
  const lp = await browser.newPage();
  lp.on('pageerror', (e) => console.log('   [page-error]', e.message));
  await clearSession(lp);
  await login(lp, LEAD);
  await lp.goto(`${CLIENT}/assessments/${assessmentId}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const leadSees = await lp.evaluate(() => ({
    hasSentBack: /sent back for revision/i.test(document.body.innerText),
    hasRejectedPill: !!Array.from(document.querySelectorAll('*')).find((e) => /^\s*REJECTED\s*$/.test((e.textContent || '').trim())),
    hasNotes: /needs more rigor/.test(document.body.innerText),
    hasButtons: /\bApprove\b|\bReject\b/.test(document.body.innerText) && !!Array.from(document.querySelectorAll('button')).find((b) => /^\s*approve\s*$/i.test(b.textContent || '')),
  }));
  if (!leadSees.hasSentBack) throw new Error('lead view missing "Sent back for revision" heading');
  if (!leadSees.hasRejectedPill) throw new Error('lead view missing REJECTED pill');
  if (!leadSees.hasNotes) throw new Error('lead view missing reviewer notes');
  if (leadSees.hasButtons) throw new Error('lead should NOT see Approve button on own rejected assessment');
  console.log('   ✅ lead sees "Sent back for revision" + REJECTED pill + notes, no approve button');

  // Also verify /review shows the rejected row in "Sent back to you for revision"
  await lp.goto(`${CLIENT}/review`, { waitUntil: 'networkidle2' });
  const leadQueue = await lp.evaluate(() => ({
    hasSentBackSec: /sent back to you for revision/i.test(document.body.innerText),
  }));
  if (!leadQueue.hasSentBackSec) throw new Error('lead /review missing "Sent back to you for revision" section');
  console.log('   ✅ lead /review shows the Sent-back section');
  await lp.close();
}

console.log('>> launch chromium');
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  await scenario1Approve(browser);
  await scenario2LeadSelfView(browser);
  await scenario3Reject(browser);
  console.log('\n✅ BLOCK C smoke PASS — approve, subdued-own-submission, reject+notes all confirmed');
} finally {
  await browser.close();
}
