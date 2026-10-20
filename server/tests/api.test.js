const request = require('supertest');
const app = require('../src/app');
const { sequelize, Student, Term, Subject, SchoolClass, EmailLog, User } = require('../src/models');
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
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${tokens[who]}`),
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
  tokens.amina = await login('amina.parent@gvma.test');
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

describe('timetable', () => {
  test('anyone linked to the class can view its timetable; others cannot', async () => {
    const nurseryRes = await api('parent').get(`/api/timetable?classId=${nursery.id}`);
    expect(nurseryRes.status).toBe(200);
    expect(nurseryRes.body).toHaveLength(30); // 6 periods x 5 days
    expect(nurseryRes.body.find((s) => s.subject).teacher.fullName).toBe('Miss Ada Nwosu');
    expect((await api('ada').get(`/api/timetable?classId=${primary.id}`)).status).toBe(403);
  });

  test('rejects a slot that overlaps another in the same class', async () => {
    const res = await api('admin').post('/api/timetable', {
      classId: nursery.id, day: 1, startTime: '08:45', endTime: '09:30', subjectId: english.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/overlaps/);
  });

  test('rejects a teacher being in two classes at once', async () => {
    // Make Ada teach English in Primary 1 too, then book it while she is teaching Nursery 2.
    await api('admin').post(`/api/classes/${primary.id}/subjects`, { subjectId: english.id, teacherId: (await User.findOne({ where: { email: 'ada.teacher@gvma.test' } })).id });
    await api('admin').post('/api/timetable', { classId: primary.id, day: 1, startTime: '12:00', endTime: '12:40', subjectId: english.id }).expect(201);
    const nurseryLate = await api('admin').post('/api/timetable', { classId: nursery.id, day: 1, startTime: '12:20', endTime: '13:00', subjectId: english.id });
    expect(nurseryLate.status).toBe(409);
    expect(nurseryLate.body.message).toMatch(/Miss Ada Nwosu is already teaching/);
  });

  test('validates times and requires a subject offered in the class', async () => {
    const base = { classId: nursery.id, day: 2, startTime: '13:00', endTime: '12:00', label: 'Nap' };
    expect((await api('admin').post('/api/timetable', base)).status).toBe(400);
    const music = await Subject.create({ name: 'Music' });
    const res = await api('admin').post('/api/timetable', { ...base, endTime: '13:30', label: null, subjectId: music.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not offered/);
  });

  test('teachers get their own weekly schedule across classes', async () => {
    const res = await api('ada').get('/api/timetable/mine');
    expect(res.status).toBe(200);
    expect(res.body.every((s) => s.teacher.fullName === 'Miss Ada Nwosu')).toBe(true);
    expect(new Set(res.body.map((s) => s.classId)).size).toBe(2);
  });

  test('only admins can change the timetable', async () => {
    expect((await api('ada').post('/api/timetable', { classId: nursery.id, day: 3, startTime: '13:00', endTime: '13:30', label: 'Story time' })).status).toBe(403);
  });
});

describe('events calendar', () => {
  const window = '?from=2026-10-01&to=2026-12-31';

  test('events are filtered by audience', async () => {
    const titles = async (who) => (await api(who).get(`/api/events${window}`)).body.map((e) => e.title);
    expect(await titles('parent')).toContain('PTA meeting');
    expect(await titles('parent')).not.toContain('Staff meeting');
    expect(await titles('ada')).toContain('Staff meeting');
    expect(await titles('ada')).not.toContain('PTA meeting');
    expect((await titles('admin')).length).toBe(7);
  });

  test('returns events that overlap the requested range', async () => {
    const res = await api('admin').get('/api/events?from=2026-10-28&to=2026-10-28');
    expect(res.body.map((e) => e.title)).toEqual(['Mid-term break']);
  });

  test('admins create events; end date cannot precede start date', async () => {
    const bad = await api('admin').post('/api/events', { title: 'Open day', startDate: '2026-11-20', endDate: '2026-11-19' });
    expect(bad.status).toBe(400);
    const ok = await api('admin').post('/api/events', { title: 'Open day', startDate: '2026-11-20', category: 'activity' });
    expect(ok.status).toBe(201);
    expect(ok.body.endDate).toBe('2026-11-20');
    expect((await api('ada').post('/api/events', { title: 'X', startDate: '2026-11-20' })).status).toBe(403);
  });
});

describe('messages', () => {
  const idOf = async (email) => (await User.findOne({ where: { email } })).id;

  test('teachers can contact only parents of their own pupils', async () => {
    const res = await api('ada').get('/api/messages/contacts');
    expect(res.status).toBe(200);
    const emails = await Promise.all(res.body.map((c) => User.findByPk(c.user.id).then((u) => u.email)));
    // Ada teaches Nursery 2 (Chiamaka Johnson, Fatima Yusuf) — and English in Primary 1 from the timetable test (David Johnson).
    expect(emails.sort()).toEqual(['amina.parent@gvma.test', 'parent@gvma.test']);
    const johnson = res.body.find((c) => c.students.some((s) => s.name === 'Chiamaka Johnson'));
    expect(johnson.reason).toMatch(/Parent of/);
  });

  test("parents see their children's teachers and the office", async () => {
    const res = await api('parent').get('/api/messages/contacts');
    const names = res.body.map((c) => c.user.fullName);
    expect(names).toEqual(expect.arrayContaining(['Miss Ada Nwosu', 'Mr. Tunde Bello', 'Mrs. Grace Okafor', 'Mr. Daniel Eze']));
    expect(res.body.find((c) => c.user.fullName === 'Miss Ada Nwosu').reason).toMatch(/Chiamaka's class teacher/);
  });

  test('a parent cannot message a teacher who does not teach their children', async () => {
    const tunde = await idOf('tunde.teacher@gvma.test');
    // Amina's only child is in Nursery 2, which Tunde does not teach.
    const res = await api('amina').post('/api/messages', { recipientId: tunde, subject: 'Hi', body: 'Hello' });
    expect(res.status).toBe(403);
  });

  test('full conversation: start, unread count, read, reply, email alerts', async () => {
    await notifications.flush();
    await EmailLog.destroy({ where: {} });
    const chiamaka = await Student.findOne({ where: { firstName: 'Chiamaka' } });
    const start = await api('ada').post('/api/messages', {
      recipientId: await idOf('parent@gvma.test'), studentId: chiamaka.id, subject: 'Field trip form', body: 'Please sign the field trip form.',
    });
    expect(start.status).toBe(201);
    expect(start.body.with.fullName).toBe('Mr. Chidi Johnson');
    const convId = start.body.id;

    // The parent has one unread message (plus whatever was seeded) and an email alert.
    const before = (await api('parent').get('/api/messages/unread-count')).body.unread;
    expect(before).toBeGreaterThanOrEqual(1);
    await notifications.flush();
    const [alert] = await EmailLog.findAll({ where: { event: 'new_message' } });
    expect(alert.to).toBe('parent@gvma.test');
    expect(alert.text).toContain('Please sign the field trip form.');

    // Opening the thread marks it read.
    const thread = await api('parent').get(`/api/messages/${convId}`);
    expect(thread.body.messages).toHaveLength(1);
    expect(thread.body.messages[0].fromMe).toBe(false);
    expect((await api('parent').get('/api/messages/unread-count')).body.unread).toBe(before - 1);

    // Reply goes back to the teacher.
    const reply = await api('parent').post(`/api/messages/${convId}`, { body: 'Signed, thank you!' });
    expect(reply.status).toBe(201);
    const list = (await api('ada').get('/api/messages')).body;
    const conv = list.find((c) => c.id === convId);
    expect(conv.unread).toBe(1);
    expect(conv.lastMessage.body).toBe('Signed, thank you!');
  });

  test('conversations are private to their two participants', async () => {
    const [conv] = (await api('ada').get('/api/messages')).body;
    expect((await api('amina').get(`/api/messages/${conv.id}`)).status).toBe(404);
    expect((await api('admin').get(`/api/messages/${conv.id}`)).status).toBe(404);
    expect((await api('amina').post(`/api/messages/${conv.id}`, { body: 'hi' })).status).toBe(404);
  });

  test('empty messages are rejected', async () => {
    const [conv] = (await api('ada').get('/api/messages')).body;
    expect((await api('ada').post(`/api/messages/${conv.id}`, { body: '   ' })).status).toBe(400);
  });
});

describe('backups', () => {
  const fs = require('fs');
  const { backup: backupConfig } = require('../src/config');

  afterAll(() => fs.rmSync(backupConfig.dir, { recursive: true, force: true }));

  test('only admins can manage backups', async () => {
    expect((await api('bursar').get('/api/backups')).status).toBe(403);
    expect((await api('ada').post('/api/backups')).status).toBe(403);
  });

  test('back up, change data, restore: data returns to the backup state', async () => {
    const created = await api('admin').post('/api/backups');
    expect(created.status).toBe(201);
    expect(created.body.name).toMatch(/-manual\.json\.gz$/);
    expect(created.body.tables.Student).toBe(6);

    const studentsBefore = await Student.count();
    const chiamaka = await Student.findOne({ where: { firstName: 'Chiamaka' } });
    const createdAtBefore = chiamaka.createdAt.toISOString();

    // Change things after the backup.
    await api('admin').post('/api/students', { admissionNo: 'GVMA/2026/099', firstName: 'New', lastName: 'Pupil', gender: 'male' }).expect(201);
    await api('admin').patch(`/api/students/${chiamaka.id}`, { firstName: 'Changed' }).expect(200);

    // Restore needs the typed confirmation.
    expect((await api('admin').post(`/api/backups/${created.body.name}/restore`, {})).status).toBe(400);
    const restored = await api('admin').post(`/api/backups/${created.body.name}/restore`, { confirm: 'RESTORE' });
    expect(restored.status).toBe(200);
    expect(restored.body.safetyBackup).toMatch(/-pre-restore\.json\.gz$/);

    expect(await Student.count()).toBe(studentsBefore);
    const after = await Student.findByPk(chiamaka.id);
    expect(after.firstName).toBe('Chiamaka');
    expect(after.createdAt.toISOString()).toBe(createdAtBefore);
    // Password hashes came back too, so people can still log in.
    expect((await request(app).post('/api/auth/login').send({ email: 'parent@gvma.test', password: DEMO_PASSWORD })).status).toBe(200);
    // New records still get fresh ids after a restore.
    await api('admin').post('/api/students', { admissionNo: 'GVMA/2026/100', firstName: 'After', lastName: 'Restore', gender: 'female' }).expect(201);
  });

  test('lists, downloads and deletes backups', async () => {
    const list = await api('admin').get('/api/backups');
    expect(list.body.schedule.intervalHours).toBe(24);
    const kinds = list.body.backups.map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['manual', 'pre-restore']));

    const { name } = list.body.backups[0];
    const file = await api('admin').get(`/api/backups/${name}/download`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.body.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b])); // gzip header

    expect((await api('admin').del(`/api/backups/${name}`)).status).toBe(204);
    expect((await api('admin').get('/api/backups')).body.backups.map((b) => b.name)).not.toContain(name);
  });

  test('rejects names that are not backup files', async () => {
    expect((await api('admin').get('/api/backups/..%2F..%2Fpackage.json/download')).status).toBe(400);
    expect((await api('admin').del('/api/backups/not-a-backup.txt')).status).toBe(400);
  });

  test('automatic backups keep only the newest ones', async () => {
    const backupUtil = require('../src/utils/backup');
    const keep = backupConfig.keep;
    backupConfig.keep = 2;
    for (let i = 0; i < 4; i += 1) {
      await backupUtil.createBackup('auto');
      await new Promise((r) => setTimeout(r, 5)); // distinct timestamps in the file names
    }
    const autos = (await backupUtil.listBackups()).filter((b) => b.kind === 'auto');
    expect(autos).toHaveLength(2);
    backupConfig.keep = keep;
  });
});

describe('password reset and sessions', () => {
  const email = 'reset.tester@gvma.test';
  const loginAs = (password) => request(app).post('/api/auth/login').send({ email, password });
  const tokenFromLatestEmail = async () => {
    const mail = await EmailLog.findOne({ where: { to: email, event: 'password_reset' }, order: [['id', 'DESC']] });
    return mail && mail.text.match(/reset-password\?token=([a-f0-9]+)/)[1];
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    await api('admin').post('/api/users', { fullName: 'Reset Tester', email, password: 'Original123', role: 'parent' }).expect(201);
  });

  test('forgot-password gives the same answer for unknown emails', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@gvma.test' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(await EmailLog.count({ where: { to: 'nobody@gvma.test' } })).toBe(0);
    expect(await tokenFromLatestEmail()).toMatch(/^[a-f0-9]{64}$/);
  });

  test('a reset link sets a new password, works once, and signs out old sessions', async () => {
    const oldSession = (await loginAs('Original123')).body.token;
    await sleep(1100); // tokens record their issue time in whole seconds
    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = await tokenFromLatestEmail();

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: 'BrandNew123' });
    expect(ok.status).toBe(200);

    expect((await loginAs('Original123')).status).toBe(401);
    expect((await loginAs('BrandNew123')).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Another123' })).status).toBe(400);
    const stale = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`);
    expect(stale.status).toBe(401);
    expect(stale.body.message).toMatch(/password was changed/);
  });

  test('expired and made-up tokens are rejected', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = await tokenFromLatestEmail();
    const { PasswordReset } = require('../src/models');
    await PasswordReset.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Whatever123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'abc', password: 'Whatever123' })).status).toBe(400);
  });

  test('reset requests are limited to 3 per hour', async () => {
    const { PasswordReset } = require('../src/models');
    const user = await User.findOne({ where: { email } });
    await PasswordReset.destroy({ where: { UserId: user.id } });
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/forgot-password').send({ email });
    expect(await PasswordReset.count({ where: { UserId: user.id } })).toBe(3);
  });

  test('changing your password keeps this session but signs out others', async () => {
    const other = (await loginAs('BrandNew123')).body.token;
    await sleep(1100);
    const mine = (await loginAs('BrandNew123')).body.token;
    const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${mine}`)
      .send({ currentPassword: 'BrandNew123', newPassword: 'Changed1234' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${other}`)).status).toBe(401);
  });

  test('refresh issues a new working token', async () => {
    const res = await api('ada').post('/api/auth/refresh');
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).body.email).toBe('ada.teacher@gvma.test');
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('dashboard', () => {
  test('returns role-specific data', async () => {
    expect((await api('admin').get('/api/dashboard')).body.stats.students).toBe(await Student.count({ where: { status: 'active' } }));
    expect((await api('parent').get('/api/dashboard')).body.children).toHaveLength(2);
    expect((await api('ada').get('/api/dashboard')).body.classes[0].isClassTeacher).toBe(true);
  });
});
