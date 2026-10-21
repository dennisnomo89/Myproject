// Builds the project report as a Word document.
// Usage: node report.js [docs dir]   (default: docs)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, Footer, PageNumber, TableOfContents, LevelFormat, TabStopType,
  PageOrientation,
} = require('docx');

const DOCS = process.argv[2] || path.join(__dirname, '..');
const img = (p) => fs.readFileSync(path.join(DOCS, p));

const BRAND = '1F5F8B';
const CONTENT_DXA = 9026; // A4 width 11906 minus 2 x 1440 margins
// The document is split into sections so wide diagrams can sit on landscape pages.
const sections = [];
let children;
function startSection(landscape = false) {
  children = [];
  sections.push({ landscape, children });
}
startSection(false);
let figureNo = { ch: 0, n: 0 };
let tableNo = { ch: 0, n: 0 };
let chapter = 0;

// ---------- helpers ----------
// Inline **bold** and *italic* markup inside paragraph text.
function runs(textValue, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(textValue))) {
    if (m.index > last) out.push(new TextRun({ text: textValue.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < textValue.length) out.push(new TextRun({ text: textValue.slice(last), ...base }));
  return out;
}

const P = (t, opts = {}) => children.push(new Paragraph({
  children: runs(t), alignment: opts.align || AlignmentType.JUSTIFIED, spacing: { after: 160, line: 360 }, ...opts.para,
}));
// One heading per chapter, so the table of contents lists "CHAPTER ONE: INTRODUCTION" once.
const H1 = (t) => {
  chapter += 1;
  figureNo = { ch: chapter, n: 0 };
  tableNo = { ch: chapter, n: 0 };
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 360 },
    children: [new TextRun({ text: `CHAPTER ${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][chapter - 1]}: ${t.toUpperCase()}` })],
  }));
};
// Unnumbered headings (front matter, references, appendices). `prefix` numbers an appendix's tables as A.1, B.1, ...
const Hplain = (t, { prefix, inToc = true } = {}) => {
  if (prefix) {
    figureNo = { ch: prefix, n: 0 };
    tableNo = { ch: prefix, n: 0 };
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    ...(inToc ? { heading: HeadingLevel.HEADING_1 } : {}),
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 360 },
    children: [new TextRun({ text: t.toUpperCase(), ...(inToc ? {} : { bold: true, size: 30, color: BRAND }) })],
  }));
};
const H2 = (t) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] }));
const H3 = (t) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t })] }));
const bullets = (items, ref = 'bullets') => items.forEach((t) => children.push(new Paragraph({
  numbering: { reference: ref, level: 0 }, children: runs(t), alignment: AlignmentType.LEFT, spacing: { after: 80, line: 320 },
})));
const numbered = (items) => {
  const ref = `num${children.length}`;
  numberedRefs.push(ref);
  bullets(items, ref);
};
const numberedRefs = [];

function caption(kind, t) {
  const c = kind === 'Figure' ? figureNo : tableNo;
  c.n += 1;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: kind === 'Table', // a table caption stays on the same page as its table
    spacing: { before: kind === 'Figure' ? 80 : 240, after: kind === 'Figure' ? 280 : 100 },
    children: [new TextRun({ text: `${kind} ${c.ch}.${c.n}: `, bold: true, size: 22 }), new TextRun({ text: t, italics: true, size: 22 })],
  });
}

function figure(file, w, h, t, maxW = 600) {
  const width = Math.min(maxW, w);
  const height = Math.round((h * width) / w);
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 }, keepNext: true,
    children: [new ImageRun({ type: 'png', data: img(file), transformation: { width, height }, altText: { title: t, description: t, name: t } })],
  }));
  children.push(caption('Figure', t));
}

// A wide diagram on its own landscape page, scaled to fill it, then back to portrait.
const LANDSCAPE_W = 930; // usable width in px (96 dpi) of landscape A4 with 1" margins
const LANDSCAPE_H = 545; // usable height, leaving room for the caption
function landscapeFigure(file, w, h, t) {
  startSection(true);
  const scale = Math.min(LANDSCAPE_W / w, LANDSCAPE_H / h);
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, keepNext: true,
    children: [new ImageRun({ type: 'png', data: img(file), transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: t, description: t, name: t } })],
  }));
  children.push(caption('Figure', t));
  startSection(false);
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '9FB3C8' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(t, headers, rows, widths) {
  children.push(caption('Table', t));
  const total = widths.reduce((a, b) => a + b, 0);
  const scaled = widths.map((w) => Math.round((w / total) * CONTENT_DXA));
  scaled[scaled.length - 1] += CONTENT_DXA - scaled.reduce((a, b) => a + b, 0);
  // Short tables are kept on one page; long ones may break between rows (never inside a row).
  const keepTogether = rows.length <= 10;
  const cell = (txt, i, head, last) => new TableCell({
    borders,
    width: { size: scaled[i], type: WidthType.DXA },
    shading: head ? { fill: BRAND, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ keepNext: keepTogether && !last, spacing: { after: 0, line: 276 }, children: runs(String(txt), { size: 21, ...(head ? { bold: true, color: 'FFFFFF' } : {}) }) })],
  });
  children.push(new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true, false)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri === rows.length - 1)) })),
    ],
  }));
  children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
}

const centre = (t, opts = {}) => children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
  children: [new TextRun({ text: t, bold: opts.bold, size: opts.size, color: opts.color, allCaps: opts.caps })],
}));

// ---------- front matter ----------
centre('[NAME OF INSTITUTION]', { bold: true, size: 28, before: 600 });
centre('[FACULTY / DEPARTMENT]', { size: 24, after: 1200 });
centre('DESIGN AND IMPLEMENTATION OF A WEB-BASED SCHOOL MANAGEMENT SYSTEM', { bold: true, size: 32, color: BRAND });
centre('FOR GLOBAL VIRGINS MONTESSORI ACADEMY', { bold: true, size: 32, color: BRAND, after: 1000 });
centre('A project report submitted in partial fulfilment of the requirements for', { size: 24, after: 40 });
centre('[COURSE CODE AND TITLE]', { size: 24, after: 900 });
centre('BY', { bold: true, size: 24, after: 200 });
[['Samuel Batu', '[Matric No.]'], ['Fred Wosornu', '[Matric No.]'], ['Seth Mensah Quaye', '[Matric No.]'], ['[Your full name] (dennisnomo89)', '[Matric No.]']]
  .forEach(([n, m]) => centre(`${n}    ${m}`, { size: 24, after: 60 }));
centre('[GROUP NAME / NUMBER]', { size: 24, before: 200, after: 900 });
centre('SUPERVISOR: [LECTURER NAME]', { bold: true, size: 24, after: 200 });
centre('OCTOBER 2026', { bold: true, size: 24 });

Hplain('Declaration');
P('We hereby declare that this project report is the result of our own work, carried out under the supervision of [Supervisor Name], and that it has not been submitted elsewhere for the award of any degree or certificate. Sources of information have been acknowledged in the references.');
children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
['Samuel Batu', 'Fred Wosornu', 'Seth Mensah Quaye', '[Your full name]'].forEach((n) => children.push(new Paragraph({
  spacing: { after: 300 }, tabStops: [{ type: TabStopType.LEFT, position: 4500 }],
  children: [new TextRun(`${n}`), new TextRun('\tSignature: ____________   Date: ________')],
})));

Hplain('Certification');
P('This is to certify that this project, titled *Design and Implementation of a Web-Based School Management System for Global Virgins Montessori Academy*, was carried out by the group members named above and meets the requirements of [Course Code and Title] at [Name of Institution].');
children.push(new Paragraph({ spacing: { before: 900 }, children: [] }));
P('______________________________                ______________________________', { align: AlignmentType.LEFT });
P('[Supervisor Name], Supervisor                            [Head of Department], Head of Department', { align: AlignmentType.LEFT });
P('Date: ________________                                         Date: ________________', { align: AlignmentType.LEFT });

Hplain('Acknowledgements');
P('[The group should write this section in its own words, for example thanking the supervisor, the management and staff of Global Virgins Montessori Academy, and anyone else who supported the project.]');

Hplain('Abstract');
P('Many small private schools still manage pupils\' records, attendance registers, examination results and school fees on paper or in scattered spreadsheets. This makes report cards slow to prepare, fee balances hard to track, and communication with parents irregular. This project designed and implemented a web-based School Management System for Global Virgins Montessori Academy that brings these activities into one secure application used by administrators, teachers, the bursar and parents.');
P('The system was developed incrementally from a Software Requirements Specification, using React for the web interface, Node.js with Express for a REST API, and a relational database accessed through the Sequelize ORM (SQLite for development and MySQL for production). It provides role-based dashboards; pupil and parent records; daily attendance; continuous assessment and examination scores with automatic grading, class positions and printable report cards that include Montessori developmental observations; fee structures, payments, numbered receipts and debtor reports; class timetables with clash detection; an events calendar; private messaging between parents and staff; announcements and email notifications; exportable reports; and automatic data backups.');
P('Security measures include bcrypt password hashing, JSON Web Token sessions that expire after inactivity, role-based data scoping, rate limiting of sign-in attempts, password reset links that can be used only once, and HTTP security headers. The system was verified with 75 automated API tests that run on every change through GitHub Actions, together with browser-based testing of each module and a full production-mode trial. The result shows that a low-cost, maintainable web application can meet the record-keeping and communication needs of a small Montessori school.');
P('**Keywords:** school management system, web application, Montessori education, Node.js, React, role-based access control.', { align: AlignmentType.LEFT });

Hplain('Table of Contents', { inToc: false });
children.push(new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }));

// ---------- Chapter 1 ----------
H1('Introduction');
H2('1.1 Background of the Study');
P('Schools generate a large amount of information every day: who is enrolled and in which class, who attended, what each pupil scored, what fees are owed and paid, and what the school needs to tell parents. In many small private schools these records are kept in exercise books, registers and spreadsheets maintained by different people. The information exists, but it is slow to combine, easy to lose and hard to share with the people who need it.');
P('Global Virgins Montessori Academy is a Montessori school serving nursery and primary pupils. Montessori education places emphasis on observing each child\'s development across areas such as practical life, sensorial work, language, mathematics and culture (Montessori, 1912; Lillard, 2017). A school management system for such a school must therefore handle both conventional records, such as attendance, scores and fees, and the developmental observations that Montessori teachers report to parents.');
P('Advances in web technology make it possible to build such a system as a web application that runs in any modern browser on a computer, tablet or phone, without installing software on each device. This project applies these technologies to the needs of Global Virgins Montessori Academy, following the requirements agreed in the group\'s Software Requirements Specification (SRS).');

H2('1.2 Statement of the Problem');
P('Based on the project proposal (SRS), the school\'s current way of working has the following problems:');
bullets([
  'Pupil records, registers and fee records are held on paper or in separate spreadsheets, so information is duplicated, hard to search and can be lost.',
  'Computing totals, averages, grades and class positions for report cards by hand is slow and error-prone at the end of every term.',
  'Fee balances are difficult to track, so following up unpaid fees and issuing receipts takes considerable office time.',
  'Communication with parents depends on letters and phone calls; parents have little visibility of their child\'s attendance, results or fee position.',
  'There is no reliable backup, so a damaged register or computer can mean permanent loss of school records.',
]);

H2('1.3 Aim and Objectives');
P('The aim of this project is to design and implement a secure, user-friendly web-based school management system that improves the efficiency, accuracy and transparency of academic and administrative activities at Global Virgins Montessori Academy.');
P('The specific objectives are:');
numbered([
  'To study the school\'s record-keeping processes and specify the system\'s requirements.',
  'To design a centralised database for pupil, staff, academic, financial and communication records.',
  'To develop modules for admission, attendance, results, fees, timetables, communication and reports.',
  'To provide role-based access for administrators, teachers, the bursar and parents.',
  'To automate result computation and the production of report cards, receipts and reports.',
  'To test the system against its requirements and evaluate it in a production-like setting.',
  'To manage development collaboratively with Git and GitHub, with traceable contributions from every member.',
]);

H2('1.4 Scope of the Study');
P('The system covers pupil admission and records, staff and parent accounts, classes and subjects, academic sessions and terms, daily attendance, continuous assessment and examination scores, Montessori observations, report cards, fees and payments, class timetables, the school calendar, announcements, private messaging between parents and staff, email notifications, exportable reports and data backup. It is a web application intended for use by one school.');
P('Online payment of fees through a payment gateway, SMS messaging, transport, hostel and payroll management, and native mobile apps are outside the scope of this version and are discussed as future work in Chapter Five.');

H2('1.5 Significance of the Study');
bullets([
  '**For the school administration:** one place to manage pupils, classes, terms and staff, with up-to-date reports and a full audit trail.',
  '**For teachers:** faster attendance taking and score entry, with grades, totals and positions calculated automatically.',
  '**For the bursar:** clear fee statements, automatic receipt numbering and a list of pupils who still owe.',
  '**For parents:** secure access to their own children\'s attendance, published report cards, fee statements and timetables, and a direct line to teachers.',
  '**For students of software engineering:** a worked example of requirements-driven, test-supported development of a real-world system.',
]);

H2('1.6 Limitations of the Study');
bullets([
  'The system was developed and tested with demonstration data; it has not yet been used with the school\'s live records.',
  'The analysis of the existing system is based on the group\'s project proposal rather than a formal survey of all staff.',
  'Emails require the school to provide an email (SMTP) account; until then they are only recorded in the system\'s Email Log.',
  'The project was completed within a single academic semester, which limited the number of optional features.',
]);

H2('1.7 Definition of Terms');
table('Definition of terms', ['Term', 'Meaning'], [
  ['API', 'Application Programming Interface: the set of web addresses the web app uses to read and change data on the server.'],
  ['REST', 'Representational State Transfer, an architectural style for web APIs (Fielding, 2000).'],
  ['ORM', 'Object-Relational Mapping: a library (here Sequelize) that maps database tables to program objects.'],
  ['JWT', 'JSON Web Token: a signed token that proves a user has logged in.'],
  ['CA', 'Continuous Assessment: marks earned during the term (out of 40 in this system).'],
  ['Migration', 'A versioned script that changes the database structure without losing data.'],
  ['CI', 'Continuous Integration: automatically running tests on every change (GitHub Actions).'],
  ['Bursar', 'The school officer responsible for fees and payments.'],
], [1, 4]);

H2('1.8 Organisation of the Report');
P('Chapter One introduces the study. Chapter Two reviews related literature and existing systems. Chapter Three describes the methodology and the system\'s analysis and design. Chapter Four presents the implementation and testing. Chapter Five summarises the work, draws conclusions and makes recommendations.');

// ---------- Chapter 2 ----------
H1('Literature Review');
H2('2.1 School Management Systems');
P('A school management system (sometimes called a student information system) is software that records and processes the information a school needs to run: enrolment, attendance, assessment, fees, timetables and communication. Such systems replace manual registers with a shared database, so that information is entered once and reused across tasks such as report cards, fee statements and reports.');
P('Typical benefits include less duplicated work, fewer calculation errors, faster access to information and better communication with parents. The main challenges reported for small schools are cost, the effort of setting the system up, the need for staff training, and the reliability of internet access.');

H2('2.2 Record-Keeping in Montessori Education');
P('Montessori education, founded by Maria Montessori, organises learning around prepared environments and children\'s self-directed work (Montessori, 1912). Teachers observe each child closely and record progress across developmental areas rather than relying on examinations alone (Lillard, 2017). Many Montessori schools that also follow a national curriculum therefore report both graded subject scores and narrative or scaled observations. The system in this project supports both: graded scores for subjects and ratings (emerging, developing, secure) with comments for five Montessori areas.');

H2('2.3 Web Application Architecture');
P('Modern business applications are commonly built as web applications with a client-server architecture. The client is a web page running in the user\'s browser; the server exposes data through an API and stores it in a database. The REST architectural style, described by Fielding (2000), organises an API around resources (such as students or payments) that are read and changed with standard HTTP methods. Separating the user interface from the API allows each to be developed and tested independently.');
P('Single-page application frameworks such as React build the interface from reusable components and update the page without full reloads, which makes the application feel responsive. On the server, Node.js with the Express framework is widely used to build REST APIs in JavaScript, which lets one language be used throughout the system. Relational databases remain the standard choice for records with many relationships, such as pupils, classes, scores and payments.');

H2('2.4 Security of Web Applications');
P('School systems hold personal data about children and families, so security is essential. The OWASP Top 10 (OWASP Foundation, 2021) lists the most critical web application security risks, including broken access control, cryptographic failures, injection, and identification and authentication failures. Defences relevant to this project include:');
bullets([
  'storing passwords only as slow, salted hashes such as bcrypt (Provos and Mazières, 1999), so leaked data does not reveal passwords;',
  'checking on the server, for every request, that the user\'s role allows the action and that the record belongs to them (for example, that a parent only sees their own children);',
  'using parameterised database queries through an ORM to prevent SQL injection;',
  'limiting repeated login attempts to slow down password guessing;',
  'ending sessions after a period of inactivity, and sending security headers such as a Content-Security-Policy.',
]);

H2('2.5 Review of Related Systems');
P('Several school management systems already exist. Open-source examples include openSIS, Fedena and Gibbon, which offer broad features such as admissions, attendance, gradebooks and timetables. Commercial cloud products also exist, typically sold on a subscription per pupil. These systems show the value of an integrated approach, but they are designed for a wide range of schools. For a small Montessori school they can be complex to configure, may not support Montessori developmental observations out of the box, and may involve ongoing subscription costs or hosting expertise.');
table('Comparison of approaches', ['Approach', 'Strengths', 'Limitations for this school'], [
  ['Paper registers and spreadsheets (current)', 'No cost; familiar to staff', 'Duplicated work, calculation errors, no parent access, no backup'],
  ['Large open-source systems', 'Many features; free licence', 'Complex set-up and hosting; Montessori observations not built in'],
  ['Commercial cloud systems', 'Hosted for the school; support', 'Ongoing subscription cost; less control over data and features'],
  ['This project', 'Built around the school\'s SRS; Montessori observations; simple to run; tested', 'Smaller feature set; the school must host it or pay for hosting'],
], [2, 2.5, 3]);

H2('2.6 Summary of the Review');
P('The review shows that an integrated, web-based system can address the problems identified in Chapter One, provided it is secure, simple to use and affordable to run. It also highlights a gap for small Montessori schools: a focused system that combines conventional records with Montessori observations, parent access and reliable backups. This project addresses that gap.');

// ---------- Chapter 3 ----------
H1('Methodology and System Design');
H2('3.1 Development Methodology');
P('The project followed an iterative and incremental approach (Sommerville, 2016), informed by Agile principles (Beck et al., 2001). Instead of building everything at once, the system was delivered in increments, each adding a complete, tested feature:');
numbered([
  'Core system: authentication, users, classes, pupils, attendance, results, fees, announcements and email notifications.',
  'Class timetables and the events calendar.',
  'Private messaging between parents and staff.',
  'Data backup and restore.',
  'Password reset and inactivity sign-out.',
  'Reports with export to Excel (CSV).',
  'Continuous integration (automatic testing on GitHub).',
  'Database migrations.',
  'Production readiness and the deployment guide.',
]);
P('Each increment was developed on its own Git branch and submitted as a GitHub pull request, so it could be reviewed and tested before merging (Chacon and Straub, 2014). Automated tests were written alongside each feature, and after increment 7 every pull request was tested automatically.');

H2('3.2 Analysis of the Existing System');
P('According to the project proposal, the school currently keeps attendance in paper registers, computes results by hand at the end of each term, records fees in books or spreadsheets, and communicates with parents mainly through letters, notices and phone calls. The weaknesses of this approach were summarised in Section 1.2. The proposed system keeps the same school processes (for example, the class teacher still takes the daily register), but records them once, in one place, and makes the results available to the right people automatically.');

H2('3.3 Requirements of the Proposed System');
H3('3.3.1 Functional requirements');
table('Functional requirements by user role', ['Role', 'Main functions'], [
  ['Administrator', 'Manage user accounts and roles; set up sessions, terms, classes, subjects and timetables; register pupils and link parents; publish results; manage events and announcements; view and export reports; back up and restore data; view the audit and email logs'],
  ['Teacher', 'Take daily attendance; enter CA and exam scores, remarks and Montessori observations; view own timetable and classes; post announcements; message parents of own pupils'],
  ['Bursar', 'Set fee structures; record payments and print receipts; view debtors and collection reports; send fee reminders'],
  ['Parent', 'View own children\'s attendance, timetable, published report cards and fee statements; message their children\'s teachers and the office; receive email notifications'],
  ['All users', 'Log in and out; reset a forgotten password; change own password; manage email preferences; read announcements and the calendar'],
], [1, 4]);
H3('3.3.2 Non-functional requirements');
table('Non-functional requirements and how they are met', ['Requirement (SRS)', 'How the system meets it'], [
  ['Performance (4.1)', 'Lightweight REST API with indexed queries; a report card is computed in well under a second with the demo data'],
  ['Security (4.2)', 'bcrypt password hashes, role checks and data scoping on every request, JWT sessions that end after 30 minutes of inactivity, sign-in rate limits, one-time reset links, security headers'],
  ['Usability (4.3)', 'Consistent layout and navigation per role; responsive design for phones and tablets; clear error and success messages'],
  ['Reliability (4.4)', 'Database transactions for multi-step changes; automatic daily backups; versioned migrations; automated tests'],
], [1.3, 4]);

H2('3.4 System Architecture');
P('The system uses a three-tier client-server architecture (Figure 3.1). Users work in a React web app in their browser. The app sends JSON requests over HTTPS to the API server, built with Node.js and Express. Each request passes through security middleware (security headers, rate limits and authentication), then access-control checks, then the controller for the module concerned, which reads and writes the database through Sequelize models. Supporting services handle grading, email, backups and the audit log.');
landscapeFigure('diagrams/architecture.png', 2200, 1240, 'System architecture');

H2('3.5 Use Case Model');
P('Figure 3.2 shows the use case diagram. Four actors interact with the system: Administrator, Teacher, Bursar and Parent. Each is a specialisation of a general User, who can log in, reset a password, read announcements and the calendar, and send messages. Each role then has its own use cases. The administrator can also carry out any teacher or bursar task.');
figure('diagrams/use-case.png', 2360, 2060, 'Use case diagram', 602);

H2('3.6 Data Flow Diagrams');
P('The context diagram (Figure 3.3) shows the system as a single process exchanging data with the four user roles and the email server. The level 1 diagram (Figure 3.4) breaks the system into seven processes and the data stores they use.');
landscapeFigure('diagrams/dfd-level-0.png', 2200, 1400, 'Data flow diagram, level 0 (context diagram)');
landscapeFigure('diagrams/dfd-level-1.png', 2600, 1860, 'Data flow diagram, level 1');

H2('3.7 Database Design');
P('The database has 22 tables. Figures 3.5 and 3.6 show the entities and their relationships, divided into two diagrams for readability. Every table has an integer primary key, and relationships are enforced with foreign keys. Unique constraints prevent duplicate records, for example one attendance record per pupil per day and one score per pupil, subject and term.');
landscapeFigure('diagrams/erd-academic.png', 2720, 2000, 'Entity relationship diagram: people, classes and academics');
landscapeFigure('diagrams/erd-fees-communication.png', 2720, 2020, 'Entity relationship diagram: fees, communication and system records');
table('Main database tables', ['Table', 'Purpose'], [
  ['Users', 'Accounts for administrators, teachers, the bursar and parents (role, hashed password, email preferences)'],
  ['Students, StudentParents', 'Pupil records and the links between pupils and their parents or guardians'],
  ['AcademicSessions, Terms', 'School years and terms, including term dates and whether results are published'],
  ['classes, Subjects, ClassSubjects', 'Classes, subjects, and which teacher teaches which subject in which class'],
  ['attendance', 'Daily attendance: present, late, absent or excused'],
  ['Scores, Observations, ReportRemarks', 'CA and exam scores, Montessori observations and report card remarks'],
  ['FeeItems, Payments', 'Fees per class and term, and payments with unique receipt numbers'],
  ['timetable_slots, events', 'Weekly timetable periods and school calendar events'],
  ['Conversations, Messages, Announcements', 'Private messages between parents and staff, and school announcements'],
  ['AuditLogs, email_log, password_resets', 'Audit trail, record of emails sent, and one-time password reset tokens'],
], [1.6, 4]);
P('The structure of the database is created and changed only through versioned migrations (Section 4.6), so the school\'s data is kept when the system is updated.');

H2('3.8 User Interface Design');
P('The interface follows a consistent layout: a top bar with the school name and the signed-in user, a sidebar menu that shows only the pages the user\'s role allows, and a content area made of cards and tables. Colours follow a calm blue and gold scheme. Common tasks need few clicks; for example, the attendance register marks every pupil present by default, so the teacher only changes the exceptions. On phones the sidebar becomes a menu button and tables scroll horizontally. Report cards and receipts have print-friendly layouts and can be saved as PDF from the browser.');

H2('3.9 Security Design');
table('Security measures', ['Threat', 'Measure'], [
  ['Password theft from the database', 'Passwords stored only as bcrypt hashes; reset tokens stored only as SHA-256 hashes'],
  ['Unauthorised access to records', 'Every API request is authenticated; roles are checked; teachers see only their classes and parents only their own children'],
  ['Password guessing', 'At most 10 failed sign-ins per email and address in 15 minutes; reset requests also limited'],
  ['Abandoned sessions', 'Sessions end after 30 minutes without activity; changing a password signs out other devices'],
  ['SQL injection', 'All database access through the Sequelize ORM with parameterised queries'],
  ['Cross-site scripting', 'React escapes output; email content is escaped and previewed in a sandboxed frame; Content-Security-Policy header'],
  ['Weak production settings', 'The server refuses to start in production without a strong secret key'],
  ['Data loss', 'Automatic daily backups, a safety backup before every restore, and an audit log of important actions'],
], [1.4, 3.6]);

// ---------- Chapter 4 ----------
H1('Implementation and Testing');
H2('4.1 Tools and Technologies');
table('Tools and technologies used', ['Area', 'Technology', 'Purpose'], [
  ['Web interface', 'React 19, Vite, React Router', 'Single-page web app with a page for each module'],
  ['Server', 'Node.js, Express', 'REST API, routing and middleware'],
  ['Database', 'Sequelize ORM; SQLite (development) and MySQL (production)', 'Data storage and relationships'],
  ['Migrations', 'Umzug', 'Versioned changes to the database structure'],
  ['Security', 'bcryptjs, jsonwebtoken, Helmet, express-rate-limit', 'Password hashing, sessions, security headers, rate limits'],
  ['Email', 'Nodemailer', 'Notification and password reset emails'],
  ['Testing', 'Jest, Supertest', 'Automated API tests'],
  ['Collaboration', 'Git, GitHub, GitHub Actions', 'Version control, pull requests and automatic testing'],
], [1.2, 2.2, 2.4]);

H2('4.2 System Implementation');
P('The source code is in one GitHub repository with two main folders: *server* (the API, about 3,200 lines) and *client* (the web app, about 3,300 lines). The server is organised into configuration, models, middleware (authentication, access control, rate limits, error handling), controllers (one per module), routes and utilities (grading, email, backup, audit log). The web app is organised into pages, shared components and services for talking to the API. The following sections present each module with screenshots taken from the running system using its demonstration data.');

H3('4.2.1 Login and dashboards');
P('Users sign in with their email address and password (Figure 4.1). A "Forgot your password?" link sends a one-time reset link by email. After signing in, each role sees its own dashboard. The administrator\'s dashboard (Figure 4.2) shows the number of pupils, teachers and classes, today\'s attendance, fees collected this term, recent activity, upcoming events and the latest announcements.');
figure('screenshots/01-login.png', 1920, 1200, 'Login page', 520);
figure('screenshots/02-admin-dashboard.png', 1920, 1200, 'Administrator dashboard');

H3('4.2.2 Pupils and fees');
P('The Students page lists pupils with search and filters by class and status (Figure 4.3). Each pupil has a profile page showing their details, linked parents, and tabs for attendance, results and fees. Figure 4.4 shows a fee statement: fees billed for the term, payments received and the outstanding balance. The bursar records payments here, and the system issues a receipt with a unique number and emails it to the parents.');
figure('screenshots/03-students.png', 1920, 1200, 'Students list');
figure('screenshots/04-student-fees.png', 1920, 1200, 'Pupil profile showing the fee statement');

H3('4.2.3 Attendance');
P('Teachers take the register for their class and date (Figure 4.5). Every pupil starts as present, so the teacher only marks exceptions as late, absent or excused. Attendance cannot be recorded for future dates, and a teacher can only take attendance for classes they teach.');
figure('screenshots/13-attendance.png', 1920, 1200, 'Taking attendance');

H3('4.2.4 Results and report cards');
P('Teachers enter CA scores (out of 40) and examination scores (out of 60) for each subject (Figure 4.6). The system checks that scores are within range, calculates totals, grades, averages and class positions, and produces a printable report card (Figure 4.7). The report card also shows attendance for the term, Montessori observations and the remarks of the class teacher and head of school. Parents can only see report cards after the administrator publishes the term\'s results, and they are emailed when that happens.');
table('Grading scale', ['Total score', 'Grade', 'Remark'], [
  ['70 – 100', 'A', 'Excellent'], ['60 – 69', 'B', 'Very Good'], ['50 – 59', 'C', 'Good'],
  ['45 – 49', 'D', 'Fair'], ['40 – 44', 'E', 'Pass'], ['0 – 39', 'F', 'Needs Improvement'],
], [1.5, 1, 2]);
figure('screenshots/14-score-entry.png', 1920, 1200, 'Score entry');
figure('screenshots/05-report-card.png', 1920, 1200, 'Printable report card');

H3('4.2.5 Timetable and calendar');
P('The administrator builds each class\'s weekly timetable (Figure 4.8). The system rejects periods that overlap in the same class, and it prevents a teacher from being booked in two classes at the same time. Teachers can view their own week, and parents see their child\'s timetable. The school calendar (Figure 4.9) shows holidays, examinations, meetings and activities, each visible to everyone, staff only or parents only.');
figure('screenshots/06-timetable.png', 1920, 1200, 'Class timetable');
figure('screenshots/07-calendar.png', 1920, 1200, 'School calendar');

H3('4.2.6 Communication');
P('Parents and staff exchange private messages (Figure 4.10). Teachers can message parents of pupils in their classes, and parents can message their children\'s teachers and the school office. Only the two people in a conversation can read it. Unread messages are shown with a badge, and the recipient is notified by email. The administrator can view every email the system has sent in the Email Log (Figure 4.11).');
figure('screenshots/16-messages.png', 1920, 1200, 'Messages between a parent and a teacher');
figure('screenshots/11-email-log.png', 1920, 1200, 'Email Log');

H3('4.2.7 Reports and backups');
P('The Reports page (Figure 4.12) provides enrolment, attendance, academic performance and fee collection reports, which can be filtered, printed or downloaded as CSV files for Excel. The Data Backup page (Figure 4.13) lists automatic daily backups and manual backups. These can be downloaded or restored; a restore must be confirmed by typing RESTORE, and the current data is saved first.');
figure('screenshots/08-reports-performance.png', 1920, 1200, 'Academic performance report');
figure('screenshots/10-backups.png', 1920, 1200, 'Data Backup page');

H3('4.2.8 Mobile use');
P('The layout adapts to small screens, so parents and teachers can use the system on their phones (Figure 4.14).');
figure('screenshots/17-mobile-dashboard.png', 780, 1688, 'Parent dashboard on a phone', 240);

H2('4.3 Testing Strategy');
P('Testing combined automated and manual methods:');
bullets([
  '**Automated API tests** (Jest and Supertest) start the application with a fresh in-memory database built by the migrations and demonstration data, then exercise each feature through its API, including permissions and error cases.',
  '**Continuous integration:** GitHub Actions runs every test on Node.js 22 and 24, and lints and builds the web app, on every push and pull request.',
  '**Browser testing:** each module was checked in a browser as the relevant role, on desktop and phone sizes.',
  '**Production trial:** the system was run in production mode on a copy of the database to confirm the start-up checks, rate limits, security headers and serving of the built web app.',
]);
table('Automated tests by area (75 tests, all passing)', ['Area', 'Tests', 'Area', 'Tests'], [
  ['Authentication', '3', 'Timetable', '6'],
  ['Role-based access', '3', 'Events calendar', '3'],
  ['Attendance', '2', 'Messages', '6'],
  ['Results', '3', 'Backups', '5'],
  ['Fees', '3', 'Password reset and sessions', '6'],
  ['Email notifications', '7', 'Reports', '8'],
  ['Dashboard', '1', 'Database migrations', '6'],
  ['Production settings check', '6', 'Rate limits', '3'],
  ['Serving the built web app', '4', '**Total**', '**75**'],
], [2.4, 0.8, 2.4, 0.8]);

H2('4.4 Selected Test Cases');
table('Selected test cases and results', ['ID', 'Test case', 'Expected result', 'Result'], [
  ['TC01', 'Log in with a wrong password', 'Access refused (401)', 'Pass'],
  ['TC02', 'Parent opens another family\'s child', 'Not found (404)', 'Pass'],
  ['TC03', 'Teacher lists pupils of a class they do not teach', 'Empty list', 'Pass'],
  ['TC04', 'Enter a CA score of 41 (maximum 40)', 'Rejected with a message', 'Pass'],
  ['TC05', 'Report card totals, grade and position', 'Total = CA + exam; position shown, e.g. "3rd"', 'Pass'],
  ['TC06', 'Parent opens unpublished results', 'Refused until results are published', 'Pass'],
  ['TC07', 'Record a payment', 'Sequential receipt number; balance reduced', 'Pass'],
  ['TC08', 'Add a timetable period that overlaps another', 'Rejected (409) with a clear message', 'Pass'],
  ['TC09', 'Book a teacher in two classes at once', 'Rejected with the teacher\'s name', 'Pass'],
  ['TC10', 'Read someone else\'s conversation', 'Not found (404)', 'Pass'],
  ['TC11', 'Back up, change data, restore', 'Data back to the backup state; logins still work', 'Pass'],
  ['TC12', 'Use a password reset link twice', 'Second use rejected', 'Pass'],
  ['TC13', 'Old session after a password change', 'Signed out (401)', 'Pass'],
  ['TC14', '11th wrong password for one account', 'Blocked (429); other accounts unaffected', 'Pass'],
  ['TC15', 'Start in production without a secret key', 'Server refuses to start', 'Pass'],
  ['TC16', 'Change a model without a migration', 'Test fails, naming the missing column', 'Pass'],
], [0.7, 2.8, 2.8, 0.7]);

H2('4.5 Defects Found and Fixed');
P('Testing found several defects before release, which shows the value of the test suite:');
bullets([
  '**Access control:** a parent could open another family\'s child, because two database conditions were combined so that one overwrote the other. A similar problem allowed a class filter to override a teacher\'s class restriction. Both were fixed, and tests TC02 and TC03 now guard against them.',
  '**Email preview:** under the production Content-Security-Policy, the email preview in the Email Log was blank. The frame\'s sandbox setting was corrected while keeping scripts disabled.',
]);

H2('4.6 Deployment and Maintenance');
P('In production, the API server also serves the built web app, so the school runs a single Node.js server behind HTTPS. At start-up, the server checks its settings: it refuses to start without a strong secret key, and it warns about missing email settings or links that point at localhost. Database changes are applied automatically through migrations, which record which changes have run so that existing data is kept. A deployment guide in the repository\'s README describes installation, configuration, HTTPS and backups.');

// ---------- Chapter 5 ----------
H1('Summary, Conclusion and Recommendations');
H2('5.1 Summary');
P('This project designed and implemented a web-based School Management System for Global Virgins Montessori Academy. Starting from the group\'s Software Requirements Specification, the system was built in nine tested increments. It covers pupil records, attendance, results and report cards with Montessori observations, fees and receipts, timetables, the calendar, messaging, announcements and email, reports and backups, with role-based access for administrators, teachers, the bursar and parents.');

H2('5.2 Achievement of Objectives');
table('Achievement of objectives', ['Objective', 'How it was achieved'], [
  ['1. Specify requirements', 'Software Requirements Specification prepared and used throughout (Section 3.3)'],
  ['2. Centralised database', '22-table relational database with enforced relationships and versioned migrations (Section 3.7)'],
  ['3. Develop modules', 'Admission, attendance, results, fees, timetable, calendar, messaging, reports and backup modules (Section 4.2)'],
  ['4. Role-based access', 'Four roles; server-side checks and data scoping on every request (Sections 3.9 and 4.4)'],
  ['5. Automate computation', 'Automatic totals, grades, positions, report cards, receipts and reports (Section 4.2.4)'],
  ['6. Test the system', '75 automated tests, continuous integration, browser and production trials (Sections 4.3 to 4.5)'],
  ['7. Collaborative development', 'GitHub repository with one branch and pull request per increment'],
], [1.8, 4]);

H2('5.3 Conclusion');
P('The project shows that a focused, low-cost web application can replace manual registers and spreadsheets at a small Montessori school, reduce repetitive work for teachers and office staff, and give parents secure, timely access to information about their children. Building in security, automated testing, backups and safe database updates from the start makes the system suitable not only as an academic exercise but as a practical tool that the school could adopt and maintain.');

H2('5.4 Recommendations');
P('For the school:');
bullets([
  'Adopt the system in phases: start with pupil records, attendance and results, then add fees and communication.',
  'Host the system on a reliable server with HTTPS, configure the school\'s email account, and remove the demonstration accounts.',
  'Train staff briefly before each term, and download a backup copy regularly to store away from the server.',
]);
P('For future development:');
bullets([
  'Online fee payment through a payment gateway.',
  'SMS notifications for parents without regular email access.',
  'A mobile app, or installable web app support for offline use.',
  'Library, inventory and staff payroll modules.',
  'Import of existing pupil records from spreadsheets.',
]);

// ---------- References ----------
Hplain('References');
[
  'Beck, K., Beedle, M., van Bennekum, A., Cockburn, A., Cunningham, W., Fowler, M., et al. (2001). *Manifesto for Agile Software Development*. https://agilemanifesto.org/',
  'Chacon, S., & Straub, B. (2014). *Pro Git* (2nd ed.). Apress.',
  'Fielding, R. T. (2000). *Architectural styles and the design of network-based software architectures* [Doctoral dissertation, University of California, Irvine].',
  'Lillard, A. S. (2017). *Montessori: The science behind the genius* (3rd ed.). Oxford University Press.',
  'Montessori, M. (1912). *The Montessori method* (A. E. George, Trans.). Frederick A. Stokes Company.',
  'OWASP Foundation. (2021). *OWASP Top 10: 2021*. https://owasp.org/Top10/',
  'Pressman, R. S., & Maxim, B. R. (2020). *Software engineering: A practitioner\'s approach* (9th ed.). McGraw-Hill Education.',
  'Provos, N., & Mazières, D. (1999). A future-adaptable password scheme. In *Proceedings of the 1999 USENIX Annual Technical Conference* (pp. 81–91). USENIX Association.',
  'Sommerville, I. (2016). *Software engineering* (10th ed.). Pearson.',
  'Express. (n.d.). *Express: Fast, unopinionated, minimalist web framework for Node.js*. https://expressjs.com/',
  'React. (n.d.). *React documentation*. https://react.dev/',
  'Sequelize. (n.d.). *Sequelize documentation*. https://sequelize.org/',
].sort((a, b) => a.localeCompare(b)).forEach((r) => children.push(new Paragraph({ children: runs(r), alignment: AlignmentType.LEFT, indent: { left: 720, hanging: 720 }, spacing: { after: 160, line: 320 } })));

// ---------- Appendices ----------
Hplain('Appendix A: Running the System', { prefix: 'A' });
P('Requirements: Node.js 20 or newer. In a terminal:', { align: AlignmentType.LEFT });
['cd server', 'npm install', 'npm run seed      (creates the demo database)', 'npm run dev       (API on http://localhost:5000)', 'cd ../client', 'npm install', 'npm run dev       (web app on http://localhost:5173)'].forEach((l) => children.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l, font: 'Courier New', size: 20 })] })));
children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
table('Demonstration accounts (password: Password123)', ['Role', 'Email'], [
  ['Administrator', 'admin@gvma.test'], ['Bursar', 'bursar@gvma.test'], ['Teacher (Nursery 2 A)', 'ada.teacher@gvma.test'],
  ['Teacher (Primary 1 A)', 'tunde.teacher@gvma.test'], ['Parent (two children)', 'parent@gvma.test'], ['Parent (one child)', 'amina.parent@gvma.test'],
], [2, 3]);
P('The demonstration accounts are for testing only and must be removed before the system is used with real data.');

Hplain('Appendix B: Development History', { prefix: 'B' });
P('Source code repository: https://github.com/dennisnomo89/Myproject', { align: AlignmentType.LEFT });
table('Increments and pull requests', ['Pull request', 'Increment'], [
  ['#1', 'Core system: API, web app and email notifications'], ['#2', 'Class timetables and school events calendar'],
  ['#3', 'Private messaging between parents and staff'], ['#4', 'Data backup and restore'],
  ['#5', 'Password reset and inactivity sign-out'], ['#6', 'School reports with CSV export'],
  ['#7', 'GitHub Actions continuous integration'], ['#8', 'Database migrations'], ['#9', 'Production readiness and deployment guide'],
], [1, 5]);

Hplain('Appendix C: Contributions of Group Members', { prefix: 'C' });
P('[To be completed by the group. List each member\'s responsibilities and main contributions, for example modules, testing, documentation and presentation.]');
table('Contributions of group members', ['Member', 'Responsibilities and contributions'], [
  ['Samuel Batu', '[ ]'], ['Fred Wosornu', '[ ]'], ['Seth Mensah Quaye', '[ ]'], ['[Your full name]', '[ ]'],
], [1.5, 4]);

// ---------- document ----------
const numberingConfig = [
  { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ...numberedRefs.map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
];

const doc = new Document({
  creator: 'GVMA project group',
  title: 'School Management System for Global Virgins Montessori Academy: Project Report',
  description: 'Final project report',
  styles: {
    default: { document: { run: { font: 'Times New Roman', size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: 'Times New Roman', color: BRAND }, paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Times New Roman' }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, italics: true, font: 'Times New Roman' }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: numberingConfig },
  // Empty sections (e.g. the portrait section right after a landscape figure that is followed by another one) are dropped.
  sections: sections.filter((s) => s.children.length).map((s) => ({
    properties: {
      page: {
        size: { width: 11906, height: 16838, ...(s.landscape ? { orientation: PageOrientation.LANDSCAPE } : {}) },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
    },
    children: s.children,
  })),
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(DOCS, 'GVMA_SMS_Project_Report.docx');
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${Math.round(buf.length / 1024)} KB)`);
});
