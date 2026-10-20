const { Op } = require('sequelize');
const { sequelize, Attendance, Student } = require('../models');
const { HttpError } = require('../utils/httpError');
const { assertCanAccessClass, assertCanAccessStudent } = require('../middleware/access');
const audit = require('../utils/audit');

const STATUSES = ['present', 'absent', 'late', 'excused'];
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Class register for a date: every active pupil with their status (or null if not yet taken).
exports.classRegister = async (req, res) => {
  const { classId, date } = req.query;
  if (!classId || !isDate(date)) throw new HttpError(400, 'classId and date (YYYY-MM-DD) are required');
  await assertCanAccessClass(req.user, classId);

  const students = await Student.findAll({
    where: { SchoolClassId: classId, status: 'active' },
    include: [{ model: Attendance, where: { date }, required: false }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
  res.json(students.map((s) => ({
    studentId: s.id,
    admissionNo: s.admissionNo,
    name: `${s.lastName} ${s.firstName}`,
    status: s.Attendances[0] ? s.Attendances[0].status : null,
  })));
};

// Save the register for a class and date. Body: { classId, date, records: [{ studentId, status }] }
exports.saveRegister = async (req, res) => {
  const { classId, date, records } = req.body;
  if (!classId || !isDate(date) || !Array.isArray(records)) {
    throw new HttpError(400, 'classId, date and records are required');
  }
  if (date > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Attendance cannot be taken for a future date');
  await assertCanAccessClass(req.user, classId);

  const classStudentIds = new Set((await Student.findAll({ where: { SchoolClassId: classId }, attributes: ['id'] })).map((s) => s.id));
  for (const r of records) {
    if (!classStudentIds.has(Number(r.studentId))) throw new HttpError(400, `Student ${r.studentId} is not in this class`);
    if (!STATUSES.includes(r.status)) throw new HttpError(400, `Invalid status "${r.status}"`);
  }

  await sequelize.transaction(async (t) => {
    for (const r of records) {
      const [row, created] = await Attendance.findOrCreate({
        where: { StudentId: r.studentId, date },
        defaults: { status: r.status, recordedById: req.user.id },
        transaction: t,
      });
      if (!created) await row.update({ status: r.status, recordedById: req.user.id }, { transaction: t });
    }
  });
  await audit(req, 'save_attendance', { classId, date, count: records.length });
  res.json({ message: `Attendance saved for ${records.length} pupils` });
};

// Per-student history and summary. Optional ?from=&to= date range.
exports.studentSummary = async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const where = { StudentId: req.params.studentId };
  const { from, to } = req.query;
  if (isDate(from) || isDate(to)) {
    where.date = {};
    if (isDate(from)) where.date[Op.gte] = from;
    if (isDate(to)) where.date[Op.lte] = to;
  }
  const records = await Attendance.findAll({ where, order: [['date', 'DESC']], attributes: ['date', 'status'] });
  const summary = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  records.forEach((r) => { summary[r.status] += 1; });
  const total = records.length;
  const attended = summary.present + summary.late;
  res.json({ summary: { ...summary, total, rate: total ? Math.round((attended / total) * 100) : null }, records });
};
