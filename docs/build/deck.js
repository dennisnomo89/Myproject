// Builds the project presentation.
// Usage: node deck.js [docs dir]   (default: docs)
const path = require('path');
const pptxgen = require('pptxgenjs');

const DOCS = process.argv[2] || path.join(__dirname, '..');
const { applyTheme } = require('./theme');
const P = (f) => path.join(DOCS, f);

const THEME = {
  name: 'GVMA Classroom',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '1D2733', lt1: 'FFFFFF', dk2: '123B57', lt2: 'EEF3F8',
    accent1: '1F5F8B', accent2: 'F2B632', accent3: '2E8B6E', accent4: 'B5543A', accent5: '6B8F3A', accent6: '637083',
    hlink: '1F5F8B', folHlink: '174A6D',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'School Management System for Global Virgins Montessori Academy';
pres.author = 'GVMA project group';
pres.company = 'Global Virgins Montessori Academy';
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'DARK',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.25, w: 5.4, h: 1.5, fontFace: THEME.headFontFace, fontSize: 36, bold: true, color: C.background1, valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.6, y: 2.85, w: 5.4, h: 0.6, fontSize: 18, color: C.accent2, valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.background1 },
  margin: [0.5, 0.5, 0.6, 0.5],
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9, h: 0.65, fontFace: THEME.headFontFace, fontSize: 28, bold: true, color: C.text2, valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: 'Global Virgins Montessori Academy  ·  School Management System', options: { x: 0.5, y: 5.2, w: 6.5, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' },
});

// ---------- helpers ----------
let slideNo = 0;
const content = (title, section, notes) => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  slideNo += 1;
  if (notes) s.addNotes(notes);
  return s;
};
const txt = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: 'top', ...o });
const card = (s, x, y, w, h, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.background2 }, line: { color: C.background2 }, objectName: name });
const badge = (s, x, y, label, fill = C.accent2, color = C.text2, size = 0.42) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { color: fill }, line: { color: fill }, objectName: `badge ${label}` });
  s.addText(String(label), { isTextBox: true, x, y, w: size, h: size, align: 'center', valign: 'middle', fontSize: 14, bold: true, color, margin: 0 });
};
const framed = (s, file, x, y, w, h, name) => {
  s.addShape(pres.shapes.RECTANGLE, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: C.background1 }, line: { color: 'C9D6E3', width: 1 }, shadow: { type: 'outer', color: '8A99A8', opacity: 0.25, blur: 6, offset: 2, angle: 90 }, objectName: `${name} frame` });
  s.addImage({ path: file, x, y, w, h, altText: name, objectName: name });
};
const fit = (iw, ih, maxW, maxH) => {
  const sc = Math.min(maxW / iw, maxH / ih);
  return { w: iw * sc, h: ih * sc };
};

// ---------- 1. Title ----------
pres.addSection({ title: 'Introduction' });
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Introduction' });
  s.addText('School Management System', { placeholder: 'title', align: 'left' });
  s.addText('for Global Virgins Montessori Academy', { placeholder: 'subtitle' });
  txt(s, 'Samuel Batu  ·  Fred Wosornu  ·  Seth Mensah Quaye  ·  [Your name]', { x: 0.6, y: 3.65, w: 5.4, h: 0.35, fontSize: 14, color: C.background1 });
  txt(s, '[Course code]  ·  Supervisor: [Name]  ·  October 2026', { x: 0.6, y: 4.05, w: 5.4, h: 0.35, fontSize: 12, color: 'B9C9D8' });
  const d = fit(1920, 1200, 3.55, 3.2);
  s.addImage({ path: P('screenshots/02-admin-dashboard.png'), x: 6.15, y: 1.25, w: d.w, h: d.h, altText: 'Administrator dashboard', objectName: 'title screenshot', shadow: { type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 4, angle: 90 } });
  s.addNotes('Introduce the group and the project: a web-based school management system built for Global Virgins Montessori Academy, from our Software Requirements Specification. The picture on the right is the real administrator dashboard.');
}

// ---------- 2. Problem ----------
{
  const s = content('The problem today', 'Introduction', 'Explain the current situation described in our SRS: paper registers and spreadsheets, hand-calculated results, hard-to-track fees, and little information for parents. Every one of these costs staff time and risks errors or lost records.');
  const items = [
    ['Paper and spreadsheets', 'Records are duplicated, hard to search and easy to lose.'],
    ['Results worked out by hand', 'Totals, grades and positions take days each term, with errors.'],
    ['Fees hard to track', 'Balances, receipts and follow-up take a lot of office time.'],
    ['Parents kept in the dark', 'Little visibility of attendance, results or fees; no backup either.'],
  ];
  items.forEach(([h, d], i) => {
    const x = 0.5 + (i % 2) * 4.6;
    const y = 1.25 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 4.4, 1.6, `problem ${i + 1}`);
    badge(s, x + 0.3, y + 0.3, i + 1, C.accent4, C.background1);
    txt(s, h, { x: x + 0.9, y: y + 0.3, w: 3.3, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    txt(s, d, { x: x + 0.9, y: y + 0.8, w: 3.3, h: 0.7, fontSize: 14 });
  });
}

// ---------- 3. Aim and objectives ----------
{
  const s = content('Aim and objectives', 'Introduction', 'Read the aim, then summarise the seven objectives. Point out that each objective is checked off in Chapter 5 of the report.');
  card(s, 0.5, 1.2, 3.6, 3.7, 'aim card');
  txt(s, 'AIM', { x: 0.8, y: 1.45, w: 3.0, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
  txt(s, 'A secure, easy-to-use web system that makes the school\'s academic and administrative work faster, more accurate and more transparent.', { x: 0.8, y: 1.85, w: 3.0, h: 2.8, fontSize: 18, fontFace: THEME.headFontFace, italic: true, color: C.text2 });
  const objs = [
    'Specify the requirements (SRS)',
    'Design one central database',
    'Build every module: records, attendance, results, fees, timetable, communication, reports',
    'Role-based access for admin, teachers, bursar and parents',
    'Automate grades, report cards, receipts and reports',
    'Test against the requirements, in a production-like setting',
    'Develop together on GitHub with traceable contributions',
  ];
  objs.forEach((o, i) => {
    const y = 1.2 + i * 0.53;
    badge(s, 4.45, y + 0.02, i + 1, C.accent2, C.text2, 0.36);
    txt(s, o, { x: 4.95, y, w: 4.55, h: 0.45, fontSize: 14, valign: 'middle' });
  });
}

// ---------- 4. Architecture ----------
pres.addSection({ title: 'Design' });
{
  const s = content('How it works', 'Design', 'Walk through the architecture from left to right: each role uses the React web app in a browser; it talks to the Node.js and Express API over HTTPS; every request passes the security layers before reaching the database. The server also sends emails and keeps daily backups. GitHub runs our 75 tests on every change.');
  const d = fit(2200, 1240, 8.4, 3.75);
  s.addImage({ path: P('diagrams/architecture.png'), x: (10 - d.w) / 2, y: 1.12, w: d.w, h: d.h, altText: 'System architecture diagram', objectName: 'architecture diagram' });
  txt(s, 'Three tiers: React web app  →  Node.js + Express API  →  SQLite / MySQL database', { x: 0.5, y: 4.9, w: 9, h: 0.3, fontSize: 12, color: C.accent6, align: 'center' });
}

// ---------- 5. Roles ----------
{
  const s = content('Four roles, one system', 'Design', 'Every user signs in to the same system, but sees only what their role allows. Explain each role briefly using the use case diagram. Stress that access is checked on the server for every request, so a parent can only ever see their own children.');
  const d = fit(2360, 2060, 4.4, 3.85);
  s.addImage({ path: P('diagrams/use-case.png'), x: 0.5, y: 1.1, w: d.w, h: d.h, altText: 'Use case diagram', objectName: 'use case diagram' });
  const roles = [
    ['Administrator', 'Users, classes, terms, timetable, publishing results, reports, backups'],
    ['Teacher', 'Attendance, scores and remarks, Montessori observations, messages'],
    ['Bursar', 'Fee structure, payments and receipts, reminders, fee reports'],
    ['Parent', 'Their own children: attendance, report cards, fees, messages'],
  ];
  roles.forEach(([r, d2], i) => {
    const y = 1.15 + i * 0.95;
    card(s, 5.15, y, 4.35, 0.82, `role ${r}`);
    txt(s, r, { x: 5.35, y: y + 0.08, w: 4.0, h: 0.32, fontSize: 16, bold: true, color: C.accent1 });
    txt(s, d2, { x: 5.35, y: y + 0.4, w: 4.0, h: 0.38, fontSize: 12 });
  });
}

// ---------- 6. Features ----------
{
  const s = content('What the system does', 'Design', 'Give a one-line tour of the eight modules. All requirements from the SRS are covered, including the Montessori developmental observations on report cards.');
  const feats = [
    ['Pupil records', 'Admission, classes, parents'],
    ['Attendance', 'Daily register in a few clicks'],
    ['Results', 'Auto grades, positions, report cards'],
    ['Fees', 'Statements, receipts, debtors'],
    ['Timetable', 'Clash-free periods, school calendar'],
    ['Communication', 'Messages, notices, email alerts'],
    ['Reports', 'Print or export to Excel'],
    ['Data backup', 'Daily, with safe restore'],
  ];
  feats.forEach(([h, d], i) => {
    const x = 0.5 + (i % 4) * 2.3;
    const y = 1.2 + Math.floor(i / 4) * 1.9;
    card(s, x, y, 2.1, 1.7, `feature ${h}`);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `feature dot ${i + 1}` });
    txt(s, String(i + 1), { x: x + 0.2, y: y + 0.2, w: 0.42, h: 0.42, align: 'center', valign: 'middle', bold: true, color: C.background1 });
    txt(s, h, { x: x + 0.2, y: y + 0.75, w: 1.8, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
    txt(s, d, { x: x + 0.2, y: y + 1.12, w: 1.8, h: 0.5, fontSize: 12, color: C.text1 });
  });
}

// ---------- 7. Dashboard ----------
pres.addSection({ title: 'The system' });
{
  const s = content('Everything at a glance', 'The system', 'Show the administrator dashboard: live counts, today\'s attendance, fees collected this term, upcoming events and the audit trail of recent activity. Teachers and parents get their own dashboards. If possible, switch to the live demo here.');
  const d = fit(1920, 1200, 5.9, 3.7);
  framed(s, P('screenshots/02-admin-dashboard.png'), 0.55, 1.2, d.w, d.h, 'admin dashboard screenshot');
  const pts = [
    ['Live numbers', 'Pupils, staff, attendance and fees'],
    ['What is coming up', 'Events and announcements'],
    ['Who did what', 'Every key action is logged'],
  ];
  pts.forEach(([h, d2], i) => {
    const y = 1.3 + i * 1.2;
    badge(s, 6.85, y, i + 1);
    txt(s, h, { x: 7.4, y: y - 0.02, w: 2.1, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
    txt(s, d2, { x: 7.4, y: y + 0.36, w: 2.1, h: 0.6, fontSize: 13 });
  });
}

// ---------- 8. Results ----------
{
  const s = content('Results without the arithmetic', 'The system', 'Teachers type CA (out of 40) and exam (out of 60) scores; the system checks the range and calculates totals, grades, averages and class positions. The report card also shows attendance, Montessori observations and remarks. Parents only see it after the administrator publishes results, and they get an email when that happens.');
  const d = fit(1920, 1200, 4.35, 2.75);
  framed(s, P('screenshots/14-score-entry.png'), 0.55, 1.25, d.w, d.h, 'score entry screenshot');
  framed(s, P('screenshots/05-report-card.png'), 5.1, 1.25, d.w, d.h, 'report card screenshot');
  txt(s, 'Teacher enters CA and exam scores', { x: 0.55, y: 4.12, w: d.w, h: 0.3, fontSize: 12, color: C.accent6, align: 'center' });
  txt(s, 'Printable report card with grades and position', { x: 5.1, y: 4.12, w: d.w, h: 0.3, fontSize: 12, color: C.accent6, align: 'center' });
  txt(s, 'Totals, grades, averages and class positions are calculated automatically.', { x: 0.55, y: 4.55, w: 8.9, h: 0.4, fontSize: 16, bold: true, color: C.accent1, align: 'center' });
}

// ---------- 9. Fees and messages ----------
{
  const s = content('Fees and communication', 'The system', 'On the left, a pupil\'s fee statement: billed, paid and balance, with numbered receipts. On the right, a private conversation between a parent and the class teacher. Every new message, receipt and published result can also be emailed.');
  const d = fit(1920, 1200, 4.35, 2.75);
  framed(s, P('screenshots/04-student-fees.png'), 0.55, 1.25, d.w, d.h, 'fee statement screenshot');
  framed(s, P('screenshots/16-messages.png'), 5.1, 1.25, d.w, d.h, 'messages screenshot');
  txt(s, 'Fee statement with the balance owed', { x: 0.55, y: 4.12, w: d.w, h: 0.3, fontSize: 12, color: C.accent6, align: 'center' });
  txt(s, 'Private parent–teacher messaging', { x: 5.1, y: 4.12, w: d.w, h: 0.3, fontSize: 12, color: C.accent6, align: 'center' });
  txt(s, 'Receipts, reminders, results and messages can all be sent by email.', { x: 0.55, y: 4.55, w: 8.9, h: 0.4, fontSize: 16, bold: true, color: C.accent1, align: 'center' });
}

// ---------- 10. Database ----------
pres.addSection({ title: 'Quality' });
{
  const s = content('Database design', 'Quality', 'The database has 22 related tables; this diagram shows the academic half. Foreign keys and unique rules stop bad data, for example two attendance records for the same pupil on the same day. Changes to the structure go through migrations, so the school never loses data when the system is updated.');
  const d = fit(2720, 2000, 5.6, 3.85);
  s.addImage({ path: P('diagrams/erd-academic.png'), x: 0.5, y: 1.1, w: d.w, h: d.h, altText: 'Entity relationship diagram', objectName: 'ERD' });
  txt(s, '22', { x: 6.55, y: 1.15, w: 2.9, h: 0.95, fontSize: 60, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
  txt(s, 'related tables', { x: 6.55, y: 2.05, w: 2.9, h: 0.35, fontSize: 14, color: C.accent6 });
  const pts = ['Foreign keys link every record', 'Unique rules block duplicates', 'Migrations update it without losing data'];
  s.addText(pts.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < pts.length - 1 } })), { isTextBox: true, x: 6.55, y: 2.6, w: 2.95, h: 2.0, fontSize: 14, color: C.text1, paraSpaceAfter: 8, margin: 0, valign: 'top' });
}

// ---------- 11. Security ----------
{
  const s = content('Security built in', 'Quality', 'The system holds children\'s data, so security was designed in from the start, following the OWASP Top 10. Go through the six measures. Mention that in production the server refuses to start without a strong secret key.');
  const items = [
    ['Hashed passwords', 'bcrypt; never stored in plain text'],
    ['Role checks on every request', 'Parents only ever see their own children'],
    ['Sign-in limits', '10 failed attempts → 15-minute block'],
    ['Sessions time out', 'Signed out after 30 idle minutes'],
    ['One-time reset links', 'Expire after an hour; used once'],
    ['Safe settings', 'Won\'t start in production without a strong key'],
  ];
  items.forEach(([h, d], i) => {
    const x = 0.5 + (i % 2) * 4.6;
    const y = 1.2 + Math.floor(i / 2) * 1.25;
    card(s, x, y, 4.4, 1.08, `security ${i + 1}`);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.3, w: 0.48, h: 0.48, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: `security tick ${i + 1}` });
    txt(s, '✓', { x: x + 0.25, y: y + 0.3, w: 0.48, h: 0.48, align: 'center', valign: 'middle', fontSize: 18, bold: true, color: C.background1 });
    txt(s, h, { x: x + 0.95, y: y + 0.17, w: 3.3, h: 0.38, fontSize: 16, bold: true, color: C.text2 });
    txt(s, d, { x: x + 0.95, y: y + 0.57, w: 3.3, h: 0.4, fontSize: 13 });
  });
}

// ---------- 12. Testing ----------
{
  const s = content('Tested on every change', 'Quality', 'We wrote 75 automated tests, grouped as shown in the chart. GitHub runs all of them on two Node.js versions every time anyone pushes code. The tests caught real bugs before release, for example a parent being able to open another family\'s child, which we fixed.');
  const stats = [['75', 'automated tests, all passing'], ['2', 'Node.js versions tested on every push'], ['3', 'real bugs caught and fixed before release']];
  stats.forEach(([n, l], i) => {
    const y = 1.15 + i * 1.25;
    txt(s, n, { x: 0.55, y, w: 1.4, h: 0.85, fontSize: 48, bold: true, color: C.accent1, fontFace: THEME.headFontFace, valign: 'middle' });
    txt(s, l, { x: 1.95, y: y + 0.12, w: 2.4, h: 0.65, fontSize: 14, valign: 'middle' });
  });
  const areas = [
    ['Accounts & security', 15], ['Reports & web app', 12], ['Backups & migrations', 11], ['Fees & email', 10],
    ['Timetable & calendar', 9], ['Core & permissions', 7], ['Messages', 6], ['Attendance & results', 5],
  ];
  s.addChart(pres.charts.BAR, [{ name: 'Tests', labels: areas.map((a) => a[0]), values: areas.map((a) => a[1]) }], {
    x: 4.6, y: 1.1, w: 4.9, h: 3.9, barDir: 'bar', catAxisOrientation: 'maxMin',
    chartColors: ['1F5F8B'], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: '1D2733', dataLabelFontFace: '+mn-lt',
    catAxisLabelFontSize: 12, catAxisLabelColor: '1D2733', catAxisLabelFontFace: '+mn-lt', catAxisLineShow: false,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: false, showTitle: true, title: 'Automated tests by area', titleFontSize: 14, titleColor: '123B57', titleFontFace: '+mn-lt', barGapWidthPct: 60,
  });
}

// ---------- 13. Process ----------
{
  const s = content('How we built it', 'Quality', 'We followed an iterative, incremental process. Each of the nine increments was built on its own branch, tested, and submitted as a GitHub pull request, so every member\'s contribution is visible in the history.');
  const steps = ['Core system', 'Timetable & calendar', 'Messaging', 'Data backup', 'Password reset', 'Reports & export', 'Automatic testing', 'Migrations', 'Production ready'];
  s.addShape(pres.shapes.LINE, { x: 0.85, y: 2.85, w: 8.3, h: 0, line: { color: C.accent1, width: 2 }, objectName: 'timeline line' });
  steps.forEach((t, i) => {
    const cx = 0.85 + i * (8.3 / 8);
    badge(s, cx - 0.25, 2.6, i + 1, i % 2 ? C.accent2 : C.accent1, i % 2 ? C.text2 : C.background1, 0.5);
    const above = i % 2 === 0;
    const label = [{ text: t, options: { bold: true, color: C.text2, breakLine: true } }, { text: `PR #${i + 1}`, options: { fontSize: 10, color: C.accent6 } }];
    txt(s, label, { x: cx - 0.6, y: above ? 1.5 : 3.25, w: 1.2, h: 0.95, fontSize: 12, align: 'center', valign: above ? 'bottom' : 'top' });
  });
  txt(s, 'One branch and pull request per increment  ·  tests with every feature', { x: 0.5, y: 4.6, w: 9, h: 0.35, fontSize: 14, color: C.accent1, align: 'center', bold: true });
}

// ---------- 14. Conclusion ----------
pres.addSection({ title: 'Close' });
{
  const s = content('Conclusion and next steps', 'Close', 'Conclude: every SRS requirement is built and tested, and the system is ready to deploy for the school. Then list the recommended next steps and future features.');
  txt(s, 'What we achieved', { x: 0.5, y: 1.15, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
  const done = ['All SRS requirements built and tested', 'Replaces paper registers and hand-worked results', 'Parents get secure, timely information', 'Ready to deploy: one server, HTTPS, daily backups'];
  s.addText(done.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < done.length - 1 } })), { isTextBox: true, x: 0.5, y: 1.65, w: 4.3, h: 3.0, fontSize: 15, color: C.text1, paraSpaceAfter: 10, margin: 0, valign: 'top' });
  card(s, 5.15, 1.15, 4.35, 3.75, 'future work card');
  txt(s, 'Next steps', { x: 5.4, y: 1.35, w: 3.9, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
  const next = ['Pilot with real records, one term at a time', 'Online fee payment', 'SMS alerts for parents', 'Installable mobile app', 'Import existing records from Excel'];
  s.addText(next.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < next.length - 1 } })), { isTextBox: true, x: 5.4, y: 1.85, w: 3.9, h: 2.9, fontSize: 15, color: C.text1, paraSpaceAfter: 10, margin: 0, valign: 'top' });
}

// ---------- 15. Thank you ----------
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Close' });
  s.addText('Thank you', { placeholder: 'title', align: 'left' });
  s.addText('Questions and live demo', { placeholder: 'subtitle' });
  txt(s, 'Demo sign-in:  admin@gvma.test  ·  Password123', { x: 0.6, y: 3.65, w: 5.4, h: 0.35, fontSize: 14, color: C.background1 });
  txt(s, 'Code: github.com/dennisnomo89/Myproject', { x: 0.6, y: 4.05, w: 5.4, h: 0.35, fontSize: 14, color: 'B9C9D8' });
  const d = fit(780, 1688, 2.0, 4.3);
  s.addImage({ path: P('screenshots/17-mobile-dashboard.png'), x: 7.2, y: 0.65, w: d.w, h: d.h, altText: 'Parent dashboard on a phone', objectName: 'phone screenshot', shadow: { type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 4, angle: 90 } });
  s.addNotes('Thank the audience and invite questions. If time allows, sign in live as the administrator, a teacher and a parent to show how each role sees different information. The phone screenshot shows that parents can use it on their phones.');
}

(async () => {
  const out = P('GVMA_SMS_Presentation.pptx');
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log(`Wrote ${out}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
