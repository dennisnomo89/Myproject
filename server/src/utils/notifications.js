// Builds and sends notification emails for school events.
// Sending happens in the background so the user's request is not slowed down.
const { Op } = require('sequelize');
const {
  Student, User, Term, AcademicSession, FeeItem, Payment, Conversation,
} = require('../models');
const { sendEmail } = require('./mailer');
const templates = require('./emailTemplates');
const { round2 } = require('./grading');

const pending = new Set();

function inBackground(promise) {
  const p = promise.catch((err) => console.error('Notification failed:', err)).finally(() => pending.delete(p));
  pending.add(p);
  return p;
}

// Waits for all background notifications (used by tests).
const flush = () => Promise.all([...pending]);

const wantsEmail = { isActive: true, emailNotifications: true };

async function studentsWithParents(where) {
  return Student.findAll({
    where: { status: 'active', ...where },
    include: [{ model: User, as: 'parents', where: wantsEmail, required: true }],
  });
}

async function balanceFor(student, termId) {
  const [billed, paid] = await Promise.all([
    student.SchoolClassId ? FeeItem.sum('amount', { where: { SchoolClassId: student.SchoolClassId, TermId: termId } }) : 0,
    Payment.sum('amount', { where: { StudentId: student.id, TermId: termId } }),
  ]);
  return { billed: round2(Number(billed) || 0), paid: round2(Number(paid) || 0), balance: round2((Number(billed) || 0) - (Number(paid) || 0)) };
}

async function sendToParents(students, event, build) {
  let count = 0;
  for (const student of students) {
    for (const parent of student.parents) {
      const email = await build(parent, student);
      if (!email) continue;
      await sendEmail({ to: parent.email, user: parent, event, ...email });
      count += 1;
    }
  }
  return count;
}

exports.resultsPublished = (termId) => inBackground((async () => {
  const term = await Term.findByPk(termId, { include: AcademicSession });
  const students = await studentsWithParents({});
  return sendToParents(students, 'results_published', (parent, student) => templates.resultsPublished({ parent, student, term }));
})());

// Emails the parents of every pupil (optionally in one class) who still owes fees. Resolves to the number of emails.
exports.feeReminders = async ({ termId, classId }) => {
  const term = await Term.findByPk(termId, { include: AcademicSession });
  const students = await studentsWithParents(classId ? { SchoolClassId: classId } : {});
  const owing = new Set();
  const emails = await sendToParents(students, 'fee_reminder', async (parent, student) => {
    const statement = await balanceFor(student, termId);
    if (statement.balance <= 0) return null;
    owing.add(student.id);
    return templates.feeReminder({ parent, student, term, ...statement });
  });
  return { emails, pupils: owing.size };
};

exports.paymentReceived = (payment) => inBackground((async () => {
  const [student] = await studentsWithParents({ id: payment.StudentId });
  if (!student) return 0;
  const { balance } = await balanceFor(student, payment.TermId);
  return sendToParents([student], 'payment_received', (parent) => templates.paymentReceived({ parent, student, payment, balance }));
})());

const AUDIENCE_ROLES = { all: ['admin', 'teacher', 'bursar', 'parent'], staff: ['admin', 'teacher', 'bursar'], parents: ['parent'] };

exports.announcement = (announcement) => inBackground((async () => {
  const users = await User.findAll({
    where: { ...wantsEmail, role: { [Op.in]: AUDIENCE_ROLES[announcement.audience] }, id: { [Op.ne]: announcement.postedById } },
  });
  for (const user of users) {
    await sendEmail({ to: user.email, user, event: 'announcement', ...templates.announcement({ user, announcement }) });
  }
  return users.length;
})());

exports.newMessage = ({ conversationId, senderId, recipientId, body }) => inBackground((async () => {
  const [recipient, sender, conversation] = await Promise.all([
    User.findOne({ where: { id: recipientId, ...wantsEmail } }),
    User.findByPk(senderId),
    Conversation.findByPk(conversationId),
  ]);
  if (!recipient) return 0;
  await sendEmail({ to: recipient.email, user: recipient, event: 'new_message', ...templates.newMessage({ recipient, sender, conversation, body }) });
  return 1;
})());

exports.flush = flush;
