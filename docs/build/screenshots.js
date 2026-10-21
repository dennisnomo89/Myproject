// Takes screenshots of the running app (dev servers on 5173/5000) with headless Edge.
// Usage: node screenshots.js [output dir]   (default: docs/screenshots)
// Start the API (port 5000) and web app (port 5173) first. Set EDGE_PATH to use another Chromium browser.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
const WEB = 'http://localhost:5173';
const API = 'http://localhost:5000/api';
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(OUT, { recursive: true });

async function tokenFor(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123' }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return (await res.json()).token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });

  const shot = async (name, url, { before, fullPage = false } = {}) => {
    await page.goto(`${WEB}${url}`, { waitUntil: 'networkidle0' });
    if (before) await before();
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
    console.log(`saved ${name}.png`);
  };
  const loginAs = async (email) => {
    const token = await tokenFor(email);
    await page.goto(WEB, { waitUntil: 'networkidle0' });
    await page.evaluate((t) => localStorage.setItem('gvma_token', t), token);
  };
  const clickText = (selector, txt) => page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === t);
    if (!el) throw new Error(`no ${s} "${t}"`);
    el.click();
  }, selector, txt);

  // Login page (signed out)
  await page.goto(WEB, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('gvma_token'));
  await shot('01-login', '/');

  // Administrator
  await loginAs('admin@gvma.test');
  await shot('02-admin-dashboard', '/');
  await shot('03-students', '/students');
  await shot('04-student-fees', '/students/2', { before: async () => { await clickText('[role=tab]', 'Fees'); await sleep(800); } });
  await shot('05-report-card', '/report/1/1');
  await shot('06-timetable', '/timetable');
  await shot('07-calendar', '/calendar');
  await shot('08-reports-performance', '/reports', { before: async () => { await clickText('[role=tab]', 'Academic performance'); await sleep(800); } });
  await shot('09-fees-collection', '/fees');
  await shot('10-backups', '/backups');
  await shot('11-email-log', '/email-log');

  // Teacher
  await loginAs('ada.teacher@gvma.test');
  await shot('12-teacher-dashboard', '/');
  await shot('13-attendance', '/attendance');
  await shot('14-score-entry', '/scores');

  // Parent
  await loginAs('parent@gvma.test');
  await shot('15-parent-dashboard', '/');
  await shot('16-messages', '/messages/1');

  // Parent on a phone
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await shot('17-mobile-dashboard', '/');

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
