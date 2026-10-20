// Resets the development database and fills it with demo data.
// Usage: npm run seed   (all demo accounts use the password below)
const bcrypt = require('bcryptjs');
const models = require('./models');

const DEMO_PASSWORD = 'Password123';

const {
  sequelize, User, AcademicSession, Term, SchoolClass, Subject, ClassSubject, Student,
  StudentParent, Attendance, Score, Observation, ReportRemark, FeeItem, Payment, Announcement,
  TimetableSlot, SchoolEvent, Conversation, Message,
} = models;

async function seed() {
  await sequelize.sync({ force: true });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mkUser = (fullName, email, role, phone) => User.create({ fullName, email, role, phone, passwordHash });

  const admin = await mkUser('Mrs. Grace Okafor', 'admin@gvma.test', 'admin', '08030000001');
  const bursar = await mkUser('Mr. Daniel Eze', 'bursar@gvma.test', 'bursar', '08030000002');
  const t1 = await mkUser('Miss Ada Nwosu', 'ada.teacher@gvma.test', 'teacher', '08030000003');
  const t2 = await mkUser('Mr. Tunde Bello', 'tunde.teacher@gvma.test', 'teacher', '08030000004');
  const p1 = await mkUser('Mr. Chidi Johnson', 'parent@gvma.test', 'parent', '08030000005');
  const p2 = await mkUser('Mrs. Amina Yusuf', 'amina.parent@gvma.test', 'parent', '08030000006');

  const session = await AcademicSession.create({ name: '2026/2027', isCurrent: true });
  const [first] = await Term.bulkCreate([
    { name: 'First', AcademicSessionId: session.id, startDate: '2026-09-14', endDate: '2026-12-18', isCurrent: true },
    { name: 'Second', AcademicSessionId: session.id, startDate: '2027-01-11', endDate: '2027-04-09' },
    { name: 'Third', AcademicSessionId: session.id, startDate: '2027-04-26', endDate: '2027-07-23' },
  ]);

  const nursery = await SchoolClass.create({ name: 'Nursery 2', arm: 'A', classTeacherId: t1.id });
  const primary = await SchoolClass.create({ name: 'Primary 1', arm: 'A', classTeacherId: t2.id });

  const subjects = await Subject.bulkCreate(
    ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'Creative Arts'].map((name) => ({ name })),
  );
  for (const cls of [nursery, primary]) {
    for (const s of subjects) {
      await ClassSubject.create({ SchoolClassId: cls.id, SubjectId: s.id, teacherId: cls.classTeacherId });
    }
  }

  const pupils = [
    ['GVMA/2026/001', 'Chiamaka', 'Johnson', 'female', '2022-03-11', nursery],
    ['GVMA/2026/002', 'David', 'Johnson', 'male', '2020-06-02', primary],
    ['GVMA/2026/003', 'Fatima', 'Yusuf', 'female', '2022-01-25', nursery],
    ['GVMA/2026/004', 'Emeka', 'Obi', 'male', '2022-08-19', nursery],
    ['GVMA/2026/005', 'Zainab', 'Adeyemi', 'female', '2020-11-30', primary],
    ['GVMA/2026/006', 'Samuel', 'Okon', 'male', '2020-04-07', primary],
  ];
  const students = [];
  for (const [admissionNo, firstName, lastName, gender, dateOfBirth, cls] of pupils) {
    students.push(await Student.create({
      admissionNo, firstName, lastName, gender, dateOfBirth, admissionDate: '2026-09-14', SchoolClassId: cls.id,
    }));
  }
  await StudentParent.bulkCreate([
    { StudentId: students[0].id, parentId: p1.id, relationship: 'Father' },
    { StudentId: students[1].id, parentId: p1.id, relationship: 'Father' },
    { StudentId: students[2].id, parentId: p2.id, relationship: 'Mother' },
  ]);

  // Two weeks of attendance on school days.
  const statuses = ['present', 'present', 'present', 'present', 'late', 'absent'];
  const day = new Date('2026-09-14');
  for (let i = 0; i < 14; i += 1, day.setDate(day.getDate() + 1)) {
    if ([0, 6].includes(day.getDay())) continue;
    const date = day.toISOString().slice(0, 10);
    for (const [j, s] of students.entries()) {
      await Attendance.create({ StudentId: s.id, date, status: statuses[(i + j) % statuses.length], recordedById: t1.id });
    }
  }

  // First-term scores (deterministic so positions are stable).
  for (const [j, s] of students.entries()) {
    for (const [k, sub] of subjects.entries()) {
      await Score.create({
        StudentId: s.id, SubjectId: sub.id, TermId: first.id,
        caScore: 22 + ((j * 7 + k * 5) % 17), examScore: 30 + ((j * 11 + k * 3) % 29),
      });
    }
    await ReportRemark.create({ StudentId: s.id, TermId: first.id, teacherRemark: 'A cheerful pupil who participates well in class.' });
  }
  for (const area of models.MONTESSORI_AREAS) {
    await Observation.create({ StudentId: students[0].id, TermId: first.id, area, rating: area === 'language' ? 'secure' : 'developing' });
  }

  for (const [cls, tuition] of [[nursery, 150000], [primary, 180000]]) {
    await FeeItem.bulkCreate([
      { SchoolClassId: cls.id, TermId: first.id, description: 'Tuition', amount: tuition },
      { SchoolClassId: cls.id, TermId: first.id, description: 'Books and Materials', amount: 25000 },
      { SchoolClassId: cls.id, TermId: first.id, description: 'Uniform', amount: 15000 },
    ]);
  }
  await Payment.bulkCreate([
    { StudentId: students[0].id, TermId: first.id, amount: 190000, method: 'transfer', receiptNo: 'GVMA-2026-00001', paidOn: '2026-09-10', recordedById: bursar.id },
    { StudentId: students[1].id, TermId: first.id, amount: 100000, method: 'cash', receiptNo: 'GVMA-2026-00002', paidOn: '2026-09-12', recordedById: bursar.id },
    { StudentId: students[2].id, TermId: first.id, amount: 190000, method: 'pos', receiptNo: 'GVMA-2026-00003', paidOn: '2026-09-15', recordedById: bursar.id },
  ]);

  // Weekly timetable: assembly, two lessons, break, two lessons, rotating subjects by day.
  const periods = [
    ['08:00', '08:30', 'Assembly'],
    ['08:30', '09:10'],
    ['09:10', '09:50'],
    ['09:50', '10:20', 'Break'],
    ['10:20', '11:00'],
    ['11:00', '11:40'],
  ];
  for (const cls of [nursery, primary]) {
    for (let day = 1; day <= 5; day += 1) {
      let lesson = 0;
      for (const [startTime, endTime, label] of periods) {
        const subject = label ? null : subjects[(day + lesson++ + (cls === primary ? 2 : 0)) % subjects.length];
        await TimetableSlot.create({ SchoolClassId: cls.id, day, startTime, endTime, label: label || null, SubjectId: subject ? subject.id : null });
      }
    }
  }

  await SchoolEvent.bulkCreate([
    { title: 'Staff meeting', category: 'meeting', startDate: '2026-10-23', endDate: '2026-10-23', audience: 'staff', createdById: admin.id },
    { title: 'Mid-term break', category: 'holiday', startDate: '2026-10-26', endDate: '2026-10-30', audience: 'all', createdById: admin.id },
    { title: 'Inter-house sports day', description: 'Parents are welcome to watch from 10am.', category: 'activity', startDate: '2026-11-06', endDate: '2026-11-06', audience: 'all', createdById: admin.id },
    { title: 'PTA meeting', description: 'School hall, 11am.', category: 'meeting', startDate: '2026-11-07', endDate: '2026-11-07', audience: 'parents', createdById: admin.id },
    { title: 'First term examinations', category: 'exam', startDate: '2026-12-07', endDate: '2026-12-11', audience: 'all', createdById: admin.id },
    { title: 'Christmas carol service', category: 'activity', startDate: '2026-12-16', endDate: '2026-12-16', audience: 'all', createdById: admin.id },
    { title: 'End of first term', category: 'holiday', startDate: '2026-12-18', endDate: '2026-12-18', audience: 'all', createdById: admin.id },
  ]);

  // A short conversation between Chiamaka's class teacher and her father.
  const convo = await Conversation.create({
    subject: "Chiamaka's reading progress",
    parentId: p1.id,
    staffId: t1.id,
    StudentId: students[0].id,
    lastMessageAt: new Date('2026-10-15T14:05:00'),
    staffLastReadAt: new Date('2026-10-15T14:05:00'),
  });
  await Message.bulkCreate([
    { ConversationId: convo.id, senderId: t1.id, body: 'Good afternoon Mr. Johnson. Chiamaka has been doing really well with her phonics this week. Reading a short story with her at home each evening would help her keep it up.', createdAt: new Date('2026-10-14T15:30:00') },
    { ConversationId: convo.id, senderId: p1.id, body: 'Thank you, Miss Nwosu. We will start reading together every evening. Is there a particular book you recommend?', createdAt: new Date('2026-10-15T08:10:00') },
    { ConversationId: convo.id, senderId: t1.id, body: 'The "Letterland" readers are perfect for her level. I will send one home in her bag on Friday.', createdAt: new Date('2026-10-15T14:05:00') },
  ]);

  await Announcement.bulkCreate([
    { title: 'Welcome to the 2026/2027 session', body: 'We are delighted to welcome all pupils and parents back to school.', audience: 'all', postedById: admin.id },
    { title: 'Mid-term break', body: 'The school will be on mid-term break from 26th to 30th October.', audience: 'parents', postedById: admin.id },
    { title: 'Staff meeting', body: 'All teaching staff should attend the meeting on Friday at 2pm.', audience: 'staff', postedById: admin.id },
  ]);

  console.log('Database seeded. Demo logins (password: %s):', DEMO_PASSWORD);
  console.table([admin, bursar, t1, t2, p1, p2].map((u) => ({ role: u.role, email: u.email })));
}

if (require.main === module) {
  seed().then(() => sequelize.close()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seed, DEMO_PASSWORD };
