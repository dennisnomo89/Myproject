const { Op } = require('sequelize');
const { sequelize, FeeItem, Payment, Student, SchoolClass, Term, AcademicSession, User } = require('../models');
const { HttpError } = require('../utils/httpError');
const { assertCanAccessStudent } = require('../middleware/access');
const { round2 } = require('../utils/grading');
const audit = require('../utils/audit');
const notifications = require('../utils/notifications');

const METHODS = ['cash', 'transfer', 'pos'];

// ---- Fee structure ----

exports.listItems = async (req, res) => {
  const { classId, termId } = req.query;
  const where = {};
  if (classId) where.SchoolClassId = classId;
  if (termId) where.TermId = termId;
  res.json(await FeeItem.findAll({ where, include: [SchoolClass, Term], order: [['id', 'ASC']] }));
};

exports.createItem = async (req, res) => {
  const { classId, termId, description, amount } = req.body;
  if (!(await SchoolClass.findByPk(classId)) || !(await Term.findByPk(termId))) {
    throw new HttpError(400, 'Valid classId and termId are required');
  }
  const item = await FeeItem.create({ SchoolClassId: classId, TermId: termId, description, amount });
  await audit(req, 'create_fee_item', { id: item.id, classId, termId, amount });
  res.status(201).json(item);
};

exports.deleteItem = async (req, res) => {
  const item = await FeeItem.findByPk(req.params.id);
  if (!item) throw new HttpError(404, 'Fee item not found');
  await item.destroy();
  await audit(req, 'delete_fee_item', { id: item.id });
  res.status(204).end();
};

// ---- Statement and payments ----

async function statementFor(student, termId) {
  const [items, payments] = await Promise.all([
    student.SchoolClassId ? FeeItem.findAll({ where: { SchoolClassId: student.SchoolClassId, TermId: termId } }) : [],
    Payment.findAll({
      where: { StudentId: student.id, TermId: termId },
      include: [{ model: User, as: 'recordedBy', attributes: ['fullName'] }],
      order: [['paidOn', 'ASC'], ['id', 'ASC']],
    }),
  ]);
  const billed = round2(items.reduce((a, i) => a + Number(i.amount), 0));
  const paid = round2(payments.reduce((a, p) => a + Number(p.amount), 0));
  return { items, payments, billed, paid, balance: round2(billed - paid) };
}

exports.statement = async (req, res) => {
  const student = await assertCanAccessStudent(req.user, req.params.studentId);
  const term = await Term.findByPk(req.query.termId, { include: AcademicSession });
  if (!term) throw new HttpError(400, 'A valid termId is required');
  res.json({ term, ...(await statementFor(student, term.id)) });
};

async function nextReceiptNo(transaction) {
  const year = new Date().getFullYear();
  const prefix = `GVMA-${year}-`;
  const last = await Payment.findOne({
    where: { receiptNo: { [Op.like]: `${prefix}%` } },
    order: [['id', 'DESC']],
    transaction,
  });
  const seq = last ? Number(last.receiptNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

// Body: { studentId, termId, amount, method, paidOn }
exports.recordPayment = async (req, res) => {
  const { studentId, termId, amount, method, paidOn } = req.body;
  const student = await Student.findByPk(studentId);
  if (!student) throw new HttpError(404, 'Student not found');
  if (!(await Term.findByPk(termId))) throw new HttpError(400, 'A valid termId is required');
  if (!METHODS.includes(method)) throw new HttpError(400, `Method must be one of: ${METHODS.join(', ')}`);
  if (!(Number(amount) > 0)) throw new HttpError(400, 'Amount must be greater than zero');

  const payment = await sequelize.transaction(async (t) => Payment.create({
    StudentId: student.id,
    TermId: termId,
    amount: Number(amount),
    method,
    paidOn: paidOn || new Date().toISOString().slice(0, 10),
    receiptNo: await nextReceiptNo(t),
    recordedById: req.user.id,
  }, { transaction: t }));

  await audit(req, 'record_payment', { id: payment.id, studentId, amount, receiptNo: payment.receiptNo });
  notifications.paymentReceived(payment);
  res.status(201).json(payment);
};

// Body: { termId, classId? } — emails parents of every pupil who still owes fees for the term.
exports.sendReminders = async (req, res) => {
  const { termId, classId } = req.body;
  if (!(await Term.findByPk(termId))) throw new HttpError(400, 'A valid termId is required');
  const { emails, pupils } = await notifications.feeReminders({ termId, classId });
  await audit(req, 'send_fee_reminders', { termId, classId: classId || 'all', emails });
  res.json({
    emails,
    pupils,
    message: emails ? `Sent ${emails} reminder email${emails === 1 ? '' : 's'} for ${pupils} pupil${pupils === 1 ? '' : 's'}` : 'No parents to remind: every pupil with an email contact has paid in full',
  });
};

exports.receipt = async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, {
    include: [
      { model: Student, include: [SchoolClass] },
      { model: Term, include: [AcademicSession] },
      { model: User, as: 'recordedBy', attributes: ['fullName'] },
    ],
  });
  if (!payment) throw new HttpError(404, 'Payment not found');
  await assertCanAccessStudent(req.user, payment.StudentId);
  const { balance } = await statementFor(payment.Student, payment.TermId);
  res.json({ payment, balanceAfter: balance });
};

// Fee collection summary per class for a term: billed, paid and outstanding.
exports.collectionReport = async (req, res) => {
  const { termId } = req.query;
  if (!(await Term.findByPk(termId))) throw new HttpError(400, 'A valid termId is required');
  const classes = await SchoolClass.findAll({ order: [['name', 'ASC'], ['arm', 'ASC']] });
  const rows = [];
  for (const cls of classes) {
    const students = await Student.findAll({ where: { SchoolClassId: cls.id, status: 'active' } });
    let billed = 0;
    let paid = 0;
    let owing = 0;
    for (const s of students) {
      const st = await statementFor(s, termId);
      billed += st.billed;
      paid += st.paid;
      if (st.balance > 0) owing += 1;
    }
    rows.push({
      classId: cls.id,
      class: `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}`,
      students: students.length,
      billed: round2(billed),
      paid: round2(paid),
      outstanding: round2(billed - paid),
      studentsOwing: owing,
    });
  }
  res.json(rows);
};

// Students in a class (or the whole school) with an outstanding balance.
exports.debtors = async (req, res) => {
  const { termId, classId } = req.query;
  if (!(await Term.findByPk(termId))) throw new HttpError(400, 'A valid termId is required');
  const where = { status: 'active' };
  if (classId) where.SchoolClassId = classId;
  const students = await Student.findAll({ where, include: [SchoolClass], order: [['lastName', 'ASC']] });
  const rows = [];
  for (const s of students) {
    const st = await statementFor(s, termId);
    if (st.balance > 0) {
      rows.push({
        studentId: s.id,
        name: `${s.lastName} ${s.firstName}`,
        admissionNo: s.admissionNo,
        class: s.SchoolClass ? `${s.SchoolClass.name}${s.SchoolClass.arm ? ` ${s.SchoolClass.arm}` : ''}` : null,
        billed: st.billed,
        paid: st.paid,
        balance: st.balance,
      });
    }
  }
  res.json(rows);
};
