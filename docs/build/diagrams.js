// Draws the project diagrams as SVG and renders PNG copies.
// Usage: node diagrams.js [output dir]   (default: docs/diagrams)
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = process.argv[2] || path.join(__dirname, '..', 'diagrams');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  brand: '#1f5f8b', brandDark: '#174a6d', light: '#e6f0f8', accent: '#f2b632', accentLight: '#fdf1d3',
  text: '#1d2733', muted: '#5b6b7d', line: '#4b5d70', border: '#9fb3c8', white: '#ffffff', store: '#eef3e6', storeEdge: '#6b8f3a',
};
const FONT = 'Arial, Helvetica, sans-serif';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svgDoc(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<title>${esc(title)}</title>
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.line}"/></marker>
</defs>
<rect width="100%" height="100%" fill="${C.white}"/>
${body}
</svg>`;
}

function text(x, y, s, { size = 13, weight = 'normal', fill = C.text, anchor = 'middle', italic = false } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}

// Multi-line centred text.
function lines(x, y, arr, opts = {}) {
  const lh = (opts.size || 13) * 1.25;
  const start = y - ((arr.length - 1) * lh) / 2;
  return arr.map((s, i) => text(x, start + i * lh + (opts.size || 13) * 0.35, s, opts)).join('');
}

// Point where the line from a box's centre towards (tx, ty) leaves the box.
function edgePoint(b, tx, ty) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (b.shape === 'ellipse') {
    const t = 1 / Math.sqrt((dx * dx) / ((b.w / 2) ** 2) + (dy * dy) / ((b.h / 2) ** 2));
    return [cx + dx * t, cy + dy * t];
  }
  const sx = dx === 0 ? Infinity : (b.w / 2) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (b.h / 2) / Math.abs(dy);
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}
const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2];

function connect(a, b, { arrow = false, label, labelPos = 0.5, dash = false, endA, endB, offset = 0 } = {}) {
  const [ax0, ay0] = centre(a);
  const [bx0, by0] = centre(b);
  // Optional sideways offset, for two parallel flows between the same pair.
  const len = Math.hypot(bx0 - ax0, by0 - ay0) || 1;
  const ox = (-(by0 - ay0) / len) * offset;
  const oy = ((bx0 - ax0) / len) * offset;
  const [x1, y1] = edgePoint({ ...a, x: a.x + ox, y: a.y + oy }, bx0 + ox, by0 + oy);
  const [x2, y2] = edgePoint({ ...b, x: b.x + ox, y: b.y + oy }, ax0 + ox, ay0 + oy);
  let s = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.line}" stroke-width="1.6"${dash ? ' stroke-dasharray="6 4"' : ''}${arrow ? ' marker-end="url(#arrow)"' : ''}/>`;
  if (label) {
    const lx = x1 + (x2 - x1) * labelPos;
    const ly = y1 + (y2 - y1) * labelPos;
    const parts = Array.isArray(label) ? label : [label];
    const w = Math.max(...parts.map((p) => p.length)) * 6.3 + 10;
    const h = parts.length * 14 + 6;
    s += `<rect x="${(lx - w / 2).toFixed(1)}" y="${(ly - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="4" fill="${C.white}" opacity="0.92"/>`;
    s += lines(lx, ly, parts, { size: 11, fill: C.muted });
  }
  // Cardinality labels just outside each box.
  const tag = (x, y, dx, dy, t) => {
    const l = Math.hypot(dx, dy) || 1;
    return text(x + (dx / l) * 16 + (-dy / l) * 9, y + (dy / l) * 16 + (dx / l) * 9 + 4, t, { size: 12, weight: 'bold', fill: C.brandDark });
  };
  if (endA) s += tag(x1, y1, x2 - x1, y2 - y1, endA);
  if (endB) s += tag(x2, y2, x1 - x2, y1 - y2, endB);
  return s;
}

function render(name, svg, title) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log(`${name}: ${title}`);
}

// ---------------------------------------------------------------- Architecture
(function architecture() {
  const W = 1100; const H = 620;
  const parts = [];
  const box = (x, y, w, h, fill, stroke, rx = 10) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;

  parts.push(text(W / 2, 36, 'System architecture', { size: 20, weight: 'bold', fill: C.brandDark }));

  // Users
  const users = ['Administrator', 'Teacher', 'Bursar', 'Parent'];
  users.forEach((u, i) => {
    const y = 90 + i * 110;
    parts.push(box(30, y, 150, 70, C.accentLight, C.accent));
    parts.push(lines(105, y + 35, [u, 'web browser'], { size: 13 }));
  });

  // Web app
  parts.push(box(240, 90, 220, 400, C.light, C.brand));
  parts.push(text(350, 120, 'Web app (React)', { size: 15, weight: 'bold', fill: C.brandDark }));
  ['Login and dashboards', 'Students, attendance', 'Results, report cards', 'Fees and receipts', 'Timetable, calendar', 'Messages, announcements', 'Reports, backups'].forEach((t, i) => {
    parts.push(box(258, 140 + i * 47, 184, 36, C.white, C.border, 6));
    parts.push(text(350, 163 + i * 47, t, { size: 12 }));
  });

  // API server
  parts.push(box(530, 90, 270, 400, C.light, C.brand));
  parts.push(text(665, 120, 'API server (Node.js + Express)', { size: 15, weight: 'bold', fill: C.brandDark }));
  const layers = [
    ['Security', 'HTTPS headers, rate limits, JWT login'],
    ['Access control', 'Roles and data scoping'],
    ['Controllers', 'One per module (REST /api)'],
    ['Sequelize models', 'Validation and relationships'],
    ['Services', 'Grading, email, backup, audit'],
  ];
  layers.forEach(([h, d], i) => {
    const y = 140 + i * 68;
    parts.push(box(548, y, 234, 56, C.white, C.border, 6));
    parts.push(text(665, y + 23, h, { size: 13, weight: 'bold' }));
    parts.push(text(665, y + 42, d, { size: 11, fill: C.muted }));
  });
  parts.push(text(665, 478, 'each request passes down these layers', { size: 10.5, fill: C.muted, italic: true }));

  // Right-hand side: database, email, backups
  parts.push(`<ellipse cx="960" cy="140" rx="100" ry="18" fill="${C.store}" stroke="${C.storeEdge}" stroke-width="1.5"/>`);
  parts.push(`<path d="M860,140 L860,230 A100,18 0 0 0 1060,230 L1060,140" fill="${C.store}" stroke="${C.storeEdge}" stroke-width="1.5"/>`);
  parts.push(`<ellipse cx="960" cy="140" rx="100" ry="18" fill="${C.store}" stroke="${C.storeEdge}" stroke-width="1.5"/>`);
  parts.push(lines(960, 192, ['Database', 'SQLite (dev) / MySQL', 'schema via migrations'], { size: 12 }));

  parts.push(box(860, 290, 200, 70, C.accentLight, C.accent));
  parts.push(lines(960, 325, ['Email server (SMTP)', 'notifications, resets'], { size: 12 }));
  parts.push(box(860, 400, 200, 70, C.accentLight, C.accent));
  parts.push(lines(960, 435, ['Backup files', 'daily gzipped JSON'], { size: 12 }));

  // Arrows
  users.forEach((_, i) => parts.push(`<line x1="180" y1="${125 + i * 110}" x2="238" y2="${125 + i * 110}" stroke="${C.line}" stroke-width="1.5" marker-end="url(#arrow)"/>`));
  parts.push(`<line x1="460" y1="290" x2="528" y2="290" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)" marker-start="url(#arrow)"/>`);
  parts.push(text(494, 278, 'JSON', { size: 11, fill: C.muted }));
  parts.push(text(494, 310, 'over HTTPS', { size: 11, fill: C.muted }));
  parts.push(`<line x1="800" y1="190" x2="858" y2="190" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)" marker-start="url(#arrow)"/>`);
  parts.push(`<line x1="800" y1="325" x2="858" y2="325" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)"/>`);
  parts.push(`<line x1="800" y1="435" x2="858" y2="435" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)" marker-start="url(#arrow)"/>`);

  // CI band
  parts.push(box(240, 525, 820, 60, '#f4f6f9', C.border, 8));
  parts.push(lines(650, 555, ['GitHub repository + GitHub Actions CI: 75 automated tests on Node 22 and 24, lint and build on every push and pull request'], { size: 12, fill: C.muted }));

  render('architecture', svgDoc(W, H, 'System architecture', parts.join('\n')), 'System architecture');
}());

// ---------------------------------------------------------------- Use case
(function useCase() {
  const W = 1180; const H = 1030;
  const parts = [];
  parts.push(text(W / 2, 36, 'Use case diagram', { size: 20, weight: 'bold', fill: C.brandDark }));
  parts.push(`<rect x="250" y="210" width="680" height="770" rx="14" fill="#fafcfe" stroke="${C.brand}" stroke-width="1.8"/>`);
  parts.push(text(590, 236, 'School Management System', { size: 15, weight: 'bold', fill: C.brandDark }));

  const figure = (x, y) => `<g stroke="${C.text}" stroke-width="2" fill="none"><circle cx="${x}" cy="${y - 34}" r="14" fill="${C.accentLight}"/><line x1="${x}" y1="${y - 20}" x2="${x}" y2="${y + 14}"/><line x1="${x - 20}" y1="${y - 8}" x2="${x + 20}" y2="${y - 8}"/><line x1="${x}" y1="${y + 14}" x2="${x - 15}" y2="${y + 40}"/><line x1="${x}" y1="${y + 14}" x2="${x + 15}" y2="${y + 40}"/></g>`;
  const actor = (x, y, name) => {
    parts.push(figure(x, y) + text(x, y + 62, name, { size: 14, weight: 'bold' }));
    return { x: x - 30, y: y - 50, w: 60, h: 110 };
  };
  // Every role is a kind of User (UML generalisation), so the shared use cases hang off User once.
  const BUS = 112; // y of the generalisation lines above the system box
  parts.push(figure(590, 120));
  parts.push(text(590, 64, 'User (any role)', { size: 14, weight: 'bold' }));
  const user = { x: 560, y: 72, w: 60, h: 100 };
  // Each actor sits level with the middle of its own group of use cases, so its lines fan out without crossing ovals.
  const A = {
    admin: actor(120, 500, 'Administrator'),
    teacher: actor(120, 800, 'Teacher'),
    parent: actor(1060, 440, 'Parent'),
    bursar: actor(1060, 765, 'Bursar'),
  };
  const gen = (pts) => parts.push(`<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${C.line}" stroke-width="1.6"/>`);
  gen([[120, 452], [120, BUS], [552, BUS]]); // admin
  gen([[100, 792], [40, 792], [40, BUS], [120, BUS]]); // teacher joins the admin branch
  gen([[1060, 392], [1060, BUS], [628, BUS]]); // parent
  gen([[1080, 757], [1140, 757], [1140, BUS], [1060, BUS]]); // bursar joins the parent branch
  // Hollow triangles: the UML symbol for "is a kind of".
  parts.push(`<path d="M570,${BUS} L552,${BUS - 9} L552,${BUS + 9} Z" fill="${C.white}" stroke="${C.line}" stroke-width="1.6"/>`);
  parts.push(`<path d="M610,${BUS} L628,${BUS - 9} L628,${BUS + 9} Z" fill="${C.white}" stroke="${C.line}" stroke-width="1.6"/>`);

  const uc = (cx, cy, label, w = 230) => {
    const h = 50;
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${C.light}" stroke="${C.brand}" stroke-width="1.5"/>`);
    parts.push(lines(cx, cy, label.split('|'), { size: 12.5 }));
    return { x: cx - w / 2, y: cy - h / 2, w, h, shape: 'ellipse' };
  };
  const U = {
    login: uc(365, 285, 'Log in /|reset password', 200),
    notices: uc(590, 285, 'View announcements|and calendar', 200),
    messages: uc(815, 285, 'Send and|read messages', 200),
    users: uc(420, 370, 'Manage users and roles'),
    setup: uc(420, 435, 'Set up classes, subjects,|terms and timetable'),
    pupils: uc(420, 500, 'Register pupils and|link parents'),
    publish: uc(420, 565, 'Publish results'),
    backup: uc(420, 630, 'Back up and restore data'),
    post: uc(420, 730, 'Post announcements|and events'),
    attendance: uc(420, 800, 'Take attendance'),
    scores: uc(420, 870, 'Enter scores, remarks|and observations'),
    report: uc(760, 370, 'View report card'),
    childinfo: uc(760, 440, "View child's attendance|and timetable"),
    statement: uc(760, 510, 'View fee statement|and receipts'),
    feesetup: uc(760, 660, 'Set fee structure'),
    payment: uc(760, 730, 'Record payment and|print receipt'),
    reminders: uc(760, 800, 'Send fee reminders'),
    reports: uc(760, 870, 'View and export reports'),
  };
  const link = (a, u) => parts.push(connect(a, u));
  ['login', 'notices', 'messages'].forEach((u) => link(user, U[u]));
  ['users', 'setup', 'pupils', 'publish', 'backup'].forEach((u) => link(A.admin, U[u]));
  ['post', 'attendance', 'scores'].forEach((u) => link(A.teacher, U[u]));
  ['report', 'childinfo', 'statement'].forEach((u) => link(A.parent, U[u]));
  ['feesetup', 'payment', 'reminders', 'reports'].forEach((u) => link(A.bursar, U[u]));
  parts.push(text(590, 935, 'The administrator can also do every teacher and bursar task, and staff can view report cards.', { size: 11.5, fill: C.muted, italic: true }));
  parts.push(text(590, 955, 'Hollow triangle = generalisation: each role is a kind of User and inherits the three shared use cases.', { size: 11.5, fill: C.muted, italic: true }));
  render('use-case', svgDoc(W, H, 'Use case diagram', parts.join('\n')), 'Use case diagram');
}());

// ---------------------------------------------------------------- DFD level 0
(function dfd0() {
  const W = 1100; const H = 700;
  const parts = [];
  parts.push(text(W / 2, 36, 'Data flow diagram — Level 0 (context)', { size: 20, weight: 'bold', fill: C.brandDark }));
  const P = { x: 410, y: 250, w: 280, h: 200, shape: 'ellipse' };
  parts.push(`<ellipse cx="550" cy="350" rx="140" ry="100" fill="${C.light}" stroke="${C.brand}" stroke-width="2"/>`);
  parts.push(lines(550, 350, ['0', 'School Management', 'System'], { size: 15, weight: 'bold', fill: C.brandDark }));
  const ent = (x, y, label) => {
    parts.push(`<rect x="${x}" y="${y}" width="180" height="60" fill="${C.accentLight}" stroke="${C.accent}" stroke-width="1.6"/>`);
    parts.push(lines(x + 90, y + 30, label.split('|'), { size: 14, weight: 'bold' }));
    return { x, y, w: 180, h: 60 };
  };
  const E = {
    admin: ent(40, 110, 'Administrator'),
    teacher: ent(40, 530, 'Teacher'),
    parent: ent(880, 110, 'Parent'),
    bursar: ent(880, 530, 'Bursar'),
    email: ent(460, 600, 'Email server'),
  };
  // Two opposite flows per entity; each label sits near the end its flow starts from, so they never overlap.
  const both = (e, toLabel, fromLabel) => {
    parts.push(connect(e, P, { arrow: true, label: toLabel, offset: 16, labelPos: 0.28 }));
    parts.push(connect(P, e, { arrow: true, label: fromLabel, offset: 16, labelPos: 0.3 }));
  };
  both(E.admin, ['users, classes, pupils,', 'terms, fees, events'], ['reports, audit log,', 'backups']);
  both(E.teacher, ['attendance, scores,', 'remarks, messages'], ['class lists, timetable,', 'broadsheets']);
  both(E.parent, ['messages, fee', 'statement requests'], ['report cards, attendance,', 'fees, notices']);
  both(E.bursar, ['fee items,', 'payments'], ['receipts, debtor and', 'collection reports']);
  parts.push(connect(P, E.email, { arrow: true, label: ['notification and', 'reset emails'], labelPos: 0.5 }));
  render('dfd-level-0', svgDoc(W, H, 'Data flow diagram level 0', parts.join('\n')), 'DFD level 0');
}());

// ---------------------------------------------------------------- DFD level 1
(function dfd1() {
  const W = 1300; const H = 930;
  const parts = [];
  parts.push(text(W / 2, 36, 'Data flow diagram — Level 1', { size: 20, weight: 'bold', fill: C.brandDark }));
  const ent = (x, y, label) => {
    parts.push(`<rect x="${x}" y="${y}" width="160" height="56" fill="${C.accentLight}" stroke="${C.accent}" stroke-width="1.6"/>`);
    parts.push(text(x + 80, y + 33, label, { size: 14, weight: 'bold' }));
    return { x, y, w: 160, h: 56 };
  };
  const proc = (y, num, label) => {
    const x = 470; const w = 250; const h = 76;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${C.light}" stroke="${C.brand}" stroke-width="1.8"/>`);
    parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x + w}" y2="${y + 24}" stroke="${C.brand}" stroke-width="1"/>`);
    parts.push(text(x + w / 2, y + 17, num, { size: 12, weight: 'bold', fill: C.brandDark }));
    parts.push(lines(x + w / 2, y + 50, label.split('|'), { size: 13 }));
    return { x, y, w, h };
  };
  const store = (y, id, label) => {
    const x = 830; const w = 230; const h = 40;
    parts.push(`<path d="M${x + w},${y} L${x},${y} L${x},${y + h} L${x + w},${y + h}" fill="${C.store}" stroke="${C.storeEdge}" stroke-width="1.6"/>`);
    parts.push(`<line x1="${x + 42}" y1="${y}" x2="${x + 42}" y2="${y + h}" stroke="${C.storeEdge}" stroke-width="1.4"/>`);
    parts.push(text(x + 21, y + 25, id, { size: 12, weight: 'bold', fill: '#3f5a1e' }));
    parts.push(text(x + 52, y + 25, label, { size: 12.5, anchor: 'start' }));
    return { x, y, w, h };
  };

  // Ordered so each external entity's flows go to neighbouring processes and no lines cross.
  const P = [
    proc(70, '1.0', 'Authenticate users|(login, reset, sessions)'),
    proc(185, '2.0', 'Manage pupils, classes|and timetable'),
    proc(300, '3.0', 'Produce reports|and backups'),
    proc(415, '4.0', 'Record attendance'),
    proc(530, '5.0', 'Process results|and report cards'),
    proc(645, '6.0', 'Communicate (messages,|announcements, email)'),
    proc(760, '7.0', 'Manage fees|and payments'),
  ];
  const S = [
    store(88, 'D1', 'Users and reset tokens'),
    store(203, 'D2', 'Pupils, classes, timetable'),
    store(318, 'D3', 'Backup files, audit log'),
    store(433, 'D4', 'Attendance'),
    store(548, 'D5', 'Scores, remarks, terms'),
    store(663, 'D6', 'Messages, notices, email log'),
    store(778, 'D7', 'Fee items and payments'),
  ];
  P.forEach((p, i) => {
    const [, y] = centre(p);
    // D1 is read and written (passwords are checked and changed), the others mainly written.
    parts.push(`<line x1="720" y1="${y}" x2="828" y2="${y}" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)"${i === 0 ? ' marker-start="url(#arrow)"' : ''}/>`);
  });
  void S;

  const E = {
    admin: ent(40, 160, 'Administrator'),
    teacher: ent(40, 430, 'Teacher'),
    parent: ent(40, 620, 'Parent'),
    bursar: ent(40, 790, 'Bursar'),
  };
  const f = (e, p, label, pos = 0.5) => parts.push(connect(e, p, { arrow: true, label, labelPos: pos }));
  f(E.admin, P[0], 'credentials');
  f(E.admin, P[1], 'pupils, classes');
  f(E.admin, P[2], 'report requests');
  f(E.teacher, P[3], 'class register');
  f(E.teacher, P[4], 'scores, remarks');
  f(E.parent, P[4], 'view report card', 0.45);
  f(E.parent, P[5], 'messages', 0.55);
  f(E.bursar, P[6], 'payments');
  // 6.0 sends email: routed below D6 so it crosses nothing.
  parts.push(`<rect x="1110" y="716" width="160" height="50" fill="${C.accentLight}" stroke="${C.accent}" stroke-width="1.6"/>`);
  parts.push(text(1190, 746, 'Email server', { size: 14, weight: 'bold' }));
  parts.push(`<polyline points="700,721 700,741 1108,741" fill="none" stroke="${C.line}" stroke-width="1.6" marker-end="url(#arrow)"/>`);
  parts.push(text(905, 758, 'notification and reset emails', { size: 11, fill: C.muted }));
  parts.push(text(640, 905, 'Processes 5.0 (results published) and 7.0 (receipts, fee reminders) also send emails through 6.0.', { size: 11.5, fill: C.muted, italic: true }));
  render('dfd-level-1', svgDoc(W, H, 'Data flow diagram level 1', parts.join('\n')), 'DFD level 1');
}());

// ---------------------------------------------------------------- ERDs
function entity(parts, x, y, name, fields, w = 240) {
  const h = 32 + fields.length * 21 + 8;
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.white}" stroke="${C.brand}" stroke-width="1.6"/>`);
  parts.push(`<path d="M${x},${y + 32} L${x},${y + 6} Q${x},${y} ${x + 6},${y} L${x + w - 6},${y} Q${x + w},${y} ${x + w},${y + 6} L${x + w},${y + 32} Z" fill="${C.brand}"/>`);
  parts.push(text(x + w / 2, y + 21, name, { size: 14, weight: 'bold', fill: C.white }));
  fields.forEach((f, i) => {
    const key = f.startsWith('PK ') ? 'PK' : f.startsWith('FK ') ? 'FK' : '';
    const label = key ? f.slice(3) : f;
    if (key) parts.push(text(x + 10, y + 52 + i * 21, key, { size: 10.5, weight: 'bold', fill: key === 'PK' ? '#a86b00' : C.brand, anchor: 'start' }));
    parts.push(text(x + 38, y + 52 + i * 21, label, { size: 12.5, anchor: 'start', weight: key === 'PK' ? 'bold' : 'normal' }));
  });
  return { x, y, w, h };
}

(function erdAcademic() {
  const W = 1360; const H = 1000;
  const parts = [];
  parts.push(text(W / 2, 36, 'Entity relationship diagram — people, classes and academics', { size: 20, weight: 'bold', fill: C.brandDark }));
  const users = entity(parts, 40, 70, 'Users', ['PK id', 'fullName', 'email (unique)', 'passwordHash', 'role', 'isActive', 'emailNotifications']);
  const sp = entity(parts, 380, 90, 'StudentParents', ['FK StudentId', 'FK parentId → Users', 'relationship']);
  const students = entity(parts, 720, 70, 'Students', ['PK id', 'admissionNo (unique)', 'firstName, lastName', 'gender, dateOfBirth', 'status', 'FK SchoolClassId']);
  const attendance = entity(parts, 1080, 70, 'Attendance', ['PK id', 'FK StudentId', 'date', 'status', 'FK recordedById → Users']);
  const cs = entity(parts, 40, 400, 'ClassSubjects', ['PK id', 'FK SchoolClassId', 'FK SubjectId', 'FK teacherId → Users']);
  const classes = entity(parts, 380, 400, 'Classes', ['PK id', 'name, arm', 'FK classTeacherId → Users']);
  const scores = entity(parts, 720, 400, 'Scores', ['PK id', 'FK StudentId', 'FK SubjectId', 'FK TermId', 'caScore, examScore', 'remark']);
  const obs = entity(parts, 1080, 400, 'Observations', ['PK id', 'FK StudentId', 'FK TermId', 'area (Montessori)', 'rating, comment']);
  const tt = entity(parts, 40, 730, 'TimetableSlots', ['PK id', 'FK SchoolClassId', 'FK SubjectId', 'day', 'startTime, endTime', 'label']);
  const subjects = entity(parts, 380, 760, 'Subjects', ['PK id', 'name (unique)']);
  const terms = entity(parts, 720, 730, 'Terms', ['PK id', 'FK AcademicSessionId', 'name', 'startDate, endDate', 'isCurrent', 'resultsPublished']);
  const sessions = entity(parts, 1080, 760, 'AcademicSessions', ['PK id', 'name (e.g. 2026/2027)', 'isCurrent']);
  const rel = (a, b) => parts.push(connect(a, b, { endA: '1', endB: 'N' }));
  rel(users, sp); rel(students, sp); rel(students, attendance);
  rel(classes, students); rel(users, classes);
  rel(classes, cs); rel(users, cs); rel(subjects, cs);
  rel(students, scores); rel(subjects, scores); rel(terms, scores);
  rel(students, obs); rel(terms, obs);
  rel(classes, tt); rel(subjects, tt);
  rel(sessions, terms);
  parts.push(text(W / 2, 975, '1 — N: one record on the "1" side relates to many on the "N" side. ReportRemarks (StudentId, TermId) follows the same pattern as Observations.', { size: 12, fill: C.muted, italic: true }));
  render('erd-academic', svgDoc(W, H, 'ERD people, classes and academics', parts.join('\n')), 'ERD academic');
}());

(function erdFeesComms() {
  const W = 1360; const H = 1010;
  const parts = [];
  parts.push(text(W / 2, 36, 'Entity relationship diagram — fees, communication and system records', { size: 20, weight: 'bold', fill: C.brandDark }));
  const classes = entity(parts, 40, 80, 'Classes', ['PK id', 'name, arm']);
  const fee = entity(parts, 380, 80, 'FeeItems', ['PK id', 'FK SchoolClassId', 'FK TermId', 'description', 'amount']);
  const terms = entity(parts, 720, 80, 'Terms', ['PK id', 'name', 'resultsPublished']);
  const students = entity(parts, 40, 380, 'Students', ['PK id', 'admissionNo', 'firstName, lastName', 'FK SchoolClassId']);
  const payments = entity(parts, 380, 360, 'Payments', ['PK id', 'FK StudentId', 'FK TermId', 'amount, method', 'receiptNo (unique)', 'paidOn', 'FK recordedById → Users']);
  const users = entity(parts, 720, 380, 'Users', ['PK id', 'fullName, email', 'role', 'passwordChangedAt']);
  const conv = entity(parts, 380, 700, 'Conversations', ['PK id', 'FK parentId → Users', 'FK staffId → Users', 'FK StudentId (optional)', 'subject', 'lastMessageAt, read times']);
  const msg = entity(parts, 720, 720, 'Messages', ['PK id', 'FK ConversationId', 'FK senderId → Users', 'body', 'createdAt']);
  const x = 1080; const side = [
    entity(parts, x, 80, 'Announcements', ['PK id', 'title, body, audience', 'FK postedById → Users']),
    entity(parts, x, 255, 'Events', ['PK id', 'title, category', 'startDate, endDate', 'FK createdById → Users']),
    entity(parts, x, 450, 'PasswordResets', ['PK id', 'FK UserId', 'tokenHash, expiresAt', 'usedAt']),
    entity(parts, x, 625, 'AuditLogs', ['PK id', 'FK UserId', 'action, details']),
    entity(parts, x, 780, 'EmailLog', ['PK id', 'FK UserId', 'event, to, subject', 'status (sent/logged/failed)']),
  ];
  const rel = (a, b) => parts.push(connect(a, b, { endA: '1', endB: 'N' }));
  rel(classes, fee); rel(terms, fee); rel(classes, students);
  rel(students, payments); rel(terms, payments); rel(users, payments);
  rel(users, conv); rel(students, conv); rel(conv, msg); rel(users, msg);
  side.forEach((s) => rel(users, s));
  parts.push(text(W / 2, 990, 'All 22 tables are created by the migration server/migrations/20261021000000-initial-schema.js.', { size: 12, fill: C.muted, italic: true }));
  render('erd-fees-communication', svgDoc(W, H, 'ERD fees and communication', parts.join('\n')), 'ERD fees and communication');
}());
