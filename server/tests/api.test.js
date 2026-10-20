const request = require('supertest');
const app = require('../src/app');
const { sequelize, Student, Term, Subject, SchoolClass, EmailLog } = require('../src/models');
const { seed, DEMO_PASSWORD } = require('../src/seed');
const notifications = require('../src/utils/notifications');

const tokens = {};
let term;
let nursery;
let primary;
let english;

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

const api = (who) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

beforeAll(async () => {
  const log = console.log;
  console.log = () => {};
  console.table = () => {};
  await seed();
  console.log = log;
  tokens.admin = await login('admin@gvma.test');
  tokens.bursar = await login('bursar@gvma.test');
  tokens.ada = await login('ada.teacher@gvma.test');
  tokens.parent = await login('parent@gvma.test');
  term = await Term.findOne({ where: { isCurrent: true } });
  nursery = await SchoolClass.findOne({ where: { name: 'Nursery 2' } });
  primary = await SchoolClass.findOne({ where: { name: 'Primary 1' } });
  english = await Subject.findOne({ where: { name: 'English Language' } });
});

afterAll(async () => {
  await notifications.flush();
  await sequelize.close();
});

describe('authentication', () => {
  test('rejects a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@gvma.test', password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('requires a token for protected routes', async () => {
    expect((await request(app).get('/api/students')).status).toBe(401);
  });

  test('never returns password hashes', async () => {
    const res = await api('admin').get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body[0].passwordHash).toBeUndefined();
  });
});

describe('role-based access', () => {
  test('only admins can create users', async () => {
    const body = { fullName: 'X', email: 'x@gvma.test', password: 'longenough', role: 'teacher' };
    expect((await api('ada').post('/api/users', body)).status).toBe(403);
    expect((await api('admin').post('/api/users', body)).status).toBe(201);
  });

  test('parents only see their own children', async () => {
    const res = await api('parent').get('/api/students');
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.lastName)).toEqual(['Johnson', 'Johnson']);

    const other = await Student.findOne({ where: { lastName: 'Yusuf' } });
    expect((await api('parent').get(`/api/students/${other.id}`)).status).toBe(404);
  });

  test('teachers only see pupils in their classes', async () => {
    const res = await api('ada').get('/api/students');
    expect(res.body.every((s) => s.SchoolClassId === nursery.id)).toBe(true);
    expect((await api('ada').get(`/api/students?classId=${primary.id}`)).body).toHaveLength(0);
    expect((await api('ada').get(`/api/attendance?classId=${primary.id}&date=2026-09-14`)).status).toBe(403);
  });
});

describe('attendance', () => {
  test('saves and reloads a class register', async () => {
    const reg = await api('ada').get(`/api/attendance?classId=${nursery.id}&date=2026-10-01`);
    expect(reg.status).toBe(200);
    const records = reg.body.map((r) => ({ studentId: r.studentId, status: 'present' }));
    expect((await api('ada').post('/api/attendance', { classId: nursery.id, date: '2026-10-01', records })).status).toBe(200);

    const again = await api('ada').get(`/api/attendance?classId=${nursery.id}&date=2026-10-01`);
    expect(again.body.every((r) => r.status === 'present')).toBe(true);
  });

  test('rejects pupils from another class', async () => {
    const outsider = await Student.findOne({ where: { SchoolClassId: primary.id } });
    const res = await api('ada').post('/api/attendance', {
      classId: nursery.id, date: '2026-10-01', records: [{ studentId: outsider.id, status: 'present' }],
    });
    expect(res.status).toBe(400);
  });
});

describe('results', () => {
  test('validates score limits', async () => {
    const pupil = await Student.findOne({ where: { SchoolClassId: nursery.id } });
    const res = await api('ada').post('/api/scores', {
      classId: nursery.id, subjectId: english.id, termId: term.id,
      scores: [{ studentId: pupil.id, caScore: 41, examScore: 50 }],
    });
    expect(res.status).toBe(400);
  });

  test('report card has totals, grades and a position', async () => {
    const pupil = await Student.findOne({ where: { firstName: 'Chiamaka' } });
    const res = await api('ada').get(`/api/results/report/${pupil.id}?termId=${term.id}`);
    expect(res.status).toBe(200);
    expect(res.body.subjects).toHaveLength(5);
    const s = res.body.subjects[0];
    expect(s.total).toBe(s.caScore + s.examScore);
    expect(res.body.summary.position).toMatch(/^\d+(st|nd|rd|th)$/);
    expect(res.body.summary.classSize).toBe(3);
  });

  test('parents only see published results', async () => {
    const child = await Student.findOne({ where: { firstName: 'Chiamaka' } });
    const url = `/api/results/report/${child.id}?termId=${term.id}`;
    expect((await api('parent').get(url)).status).toBe(403);
    await api('admin').patch(`/api/terms/${term.id}`, { resultsPublished: true });
    expect((await api('parent').get(url)).status).toBe(200);
    await api('admin').patch(`/api/terms/${term.id}`, { resultsPublished: false });
  });
});

describe('fees', () => {
  test('statement shows billed, paid and balance', async () => {
    const david = await Student.findOne({ where: { firstName: 'David' } });
    const res = await api('parent').get(`/api/fees/statement/${david.id}?termId=${term.id}`);
    expect(res.status).toBe(200);
    expect(res.body.billed).toBe(220000);
    expect(res.body.paid).toBe(100000);
    expect(res.body.balance).toBe(120000);
  });

  test('payments get sequential receipt numbers and reduce the balance', async () => {
    const david = await Student.findOne({ where: { firstName: 'David' } });
    const res = await api('bursar').post('/api/fees/payments', {
      studentId: david.id, termId: term.id, amount: 20000, method: 'cash',
    });
    expect(res.status).toBe(201);
    expect(res.body.receiptNo).toMatch(/^GVMA-\d{4}-\d{5}$/);

    const receipt = await api('parent').get(`/api/fees/payments/${res.body.id}/receipt`);
    expect(receipt.body.balanceAfter).toBe(100000);
  });

  test('teachers cannot record payments', async () => {
    const david = await Student.findOne({ where: { firstName: 'David' } });
    const res = await api('ada').post('/api/fees/payments', { studentId: david.id, termId: term.id, amount: 1, method: 'cash' });
    expect(res.status).toBe(403);
  });
});

describe('email notifications', () => {
  beforeEach(async () => {
    await notifications.flush();
    await EmailLog.destroy({ where: {} });
  });

  const emailsFor = (event) => EmailLog.findAll({ where: { event }, order: [['to', 'ASC']] });

  test('publishing results emails each parent once per child', async () => {
    await api('admin').patch(`/api/terms/${term.id}`, { resultsPublished: true });
    await notifications.flush();
    const sent = await emailsFor('results_published');
    // parent@gvma.test has two children, amina.parent@gvma.test has one.
    expect(sent.map((e) => e.to)).toEqual(['amina.parent@gvma.test', 'parent@gvma.test', 'parent@gvma.test']);
    expect(sent.every((e) => e.status === 'logged')).toBe(true);
    expect(sent[0].text).toContain(`/report/`);

    // Saving the term again while already published must not re-send.
    await api('admin').patch(`/api/terms/${term.id}`, { resultsPublished: true });
    await notifications.flush();
    expect(await emailsFor('results_published')).toHaveLength(3);
    await api('admin').patch(`/api/terms/${term.id}`, { resultsPublished: false });
  });

  test('fee reminders only go to parents of pupils who owe', async () => {
    const res = await api('bursar').post('/api/fees/reminders', { termId: term.id });
    expect(res.status).toBe(200);
    const sent = await emailsFor('fee_reminder');
    // Only David Johnson still owes among pupils with linked parents.
    expect(sent.map((e) => e.to)).toEqual(['parent@gvma.test']);
    expect(sent[0].subject).toContain('David Johnson');
    expect(sent[0].text).toMatch(/Outstanding balance: ₦\s?100,000/);
    expect(res.body).toMatchObject({ emails: 1, pupils: 1 });
  });

  test('teachers cannot send fee reminders', async () => {
    expect((await api('ada').post('/api/fees/reminders', { termId: term.id })).status).toBe(403);
  });

  test('recording a payment emails a receipt to the parent', async () => {
    const fatima = await Student.findOne({ where: { firstName: 'Fatima' } });
    const res = await api('bursar').post('/api/fees/payments', { studentId: fatima.id, termId: term.id, amount: 5000, method: 'cash' });
    await notifications.flush();
    const [email] = await emailsFor('payment_received');
    expect(email.to).toBe('amina.parent@gvma.test');
    expect(email.subject).toContain(res.body.receiptNo);
  });

  test('announcements reach the right audience and respect opt-outs', async () => {
    await api('parent').patch('/api/auth/me', { emailNotifications: false });
    await api('admin').post('/api/announcements', { title: 'Sports day', body: 'Friday at 10am.', audience: 'parents' });
    await notifications.flush();
    expect((await emailsFor('announcement')).map((e) => e.to)).toEqual(['amina.parent@gvma.test']);
    await api('parent').patch('/api/auth/me', { emailNotifications: true });
  });

  test('message content is HTML-escaped', async () => {
    await api('admin').post('/api/announcements', { title: 'Test', body: '<script>alert(1)</script>', audience: 'staff' });
    await notifications.flush();
    const [email] = await emailsFor('announcement');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  test('only admins can read the email log', async () => {
    expect((await api('bursar').get('/api/email-log')).status).toBe(403);
    const res = await api('admin').get('/api/email-log');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('log');
  });
});

describe('dashboard', () => {
  test('returns role-specific data', async () => {
    expect((await api('admin').get('/api/dashboard')).body.stats.students).toBe(6);
    expect((await api('parent').get('/api/dashboard')).body.children).toHaveLength(2);
    expect((await api('ada').get('/api/dashboard')).body.classes[0].isClassTeacher).toBe(true);
  });
});
