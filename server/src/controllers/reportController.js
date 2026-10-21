// School reports (SRS 3.2): enrolment, attendance summary, academic performance and fee collection.
// Each report is built once as { title, subtitle, columns, rows, totals } and returned as JSON
// for the screen, or as CSV (?format=csv) for Excel.
const { Op } = require('sequelize');
const {
  Student, SchoolClass, Attendance, Score, Term, AcademicSession,
} = require('../models');
const { HttpError } = require('../utils/httpError');
const { gradeFor, rankPositions, ordinal, round2 } = require('../utils/grading');
const { statementFor } = require('./feeController');
const { toCsv } = require('../utils/csv');
const audit = require('../utils/audit');

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const classLabel = (c) => (c ? `${c.name}${c.arm ? ` ${c.arm}` : ''}` : 'No class');
const byClassThenName = (a, b) => a.class.localeCompare(b.class) || a.pupil.localeCompare(b.pupil);

async function findTerm(termId) {
  const term = termId
    ? await Term.findByPk(termId, { include: AcademicSession })
    : await Term.findOne({ where: { isCurrent: true }, include: AcademicSession });
  if (!term) throw new HttpError(400, 'Choose a term (no current term is set)');
  return term;
}
const termLabel = (t) => `${t.name} Term ${t.AcademicSession.name}`;

async function classesFor(classId) {
  const where = classId ? { id: classId } : {};
  const classes = await SchoolClass.findAll({ where, order: [['name', 'ASC'], ['arm', 'ASC']] });
  if (classId && !classes.length) throw new HttpError(400, 'Class not found');
  return classes;
}

// ---- Enrolment: active pupils per class by gender ----
async function enrolment() {
  const classes = await classesFor();
  const students = await Student.findAll({ where: { status: 'active' }, attributes: ['SchoolClassId', 'gender'] });
  const rows = [...classes.map((c) => ({ id: c.id, class: classLabel(c) })), { id: null, class: 'No class' }].map((c) => {
    const mine = students.filter((s) => (s.SchoolClassId || null) === c.id);
    return { class: c.class, female: mine.filter((s) => s.gender === 'female').length, male: mine.filter((s) => s.gender === 'male').length, total: mine.length };
  }).filter((r) => r.class !== 'No class' || r.total > 0);
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return {
    title: 'Enrolment by class',
    subtitle: `Active pupils as at ${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'class', label: 'Class' },
      { key: 'female', label: 'Girls', numeric: true },
      { key: 'male', label: 'Boys', numeric: true },
      { key: 'total', label: 'Total', numeric: true },
    ],
    rows,
    totals: { class: 'All classes', female: sum('female'), male: sum('male'), total: sum('total') },
  };
}

// ---- Attendance summary per pupil for a date range (defaults to the term's dates) ----
async function attendance({ classId, termId, from, to }) {
  let range = { from, to };
  if (!isDate(from) || !isDate(to)) {
    const term = await findTerm(termId);
    if (!term.startDate || !term.endDate) throw new HttpError(400, 'Set the term dates on the Sessions & Terms page, or choose a date range');
    range = { from: term.startDate, to: term.endDate };
  }
  if (range.from > range.to) throw new HttpError(400, 'The start date must be before the end date');

  const where = { status: 'active', ...(classId && { SchoolClassId: classId }) };
  const students = await Student.findAll({
    where,
    include: [
      SchoolClass,
      { model: Attendance, where: { date: { [Op.between]: [range.from, range.to] } }, required: false },
    ],
  });
  const rows = students.map((s) => {
    const count = (st) => s.Attendances.filter((a) => a.status === st).length;
    const total = s.Attendances.length;
    const attended = count('present') + count('late');
    return {
      class: classLabel(s.SchoolClass),
      admissionNo: s.admissionNo,
      pupil: `${s.lastName} ${s.firstName}`,
      present: count('present'),
      late: count('late'),
      absent: count('absent'),
      excused: count('excused'),
      days: total,
      rate: total ? Math.round((attended / total) * 100) : null,
    };
  }).sort(byClassThenName);
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const days = sum('days');
  return {
    title: 'Attendance summary',
    subtitle: `${range.from} to ${range.to}${classId ? ` · ${rows[0]?.class || ''}` : ' · All classes'}`,
    columns: [
      { key: 'class', label: 'Class' },
      { key: 'admissionNo', label: 'Admission no.' },
      { key: 'pupil', label: 'Pupil' },
      { key: 'present', label: 'Present', numeric: true },
      { key: 'late', label: 'Late', numeric: true },
      { key: 'absent', label: 'Absent', numeric: true },
      { key: 'excused', label: 'Excused', numeric: true },
      { key: 'days', label: 'Days recorded', numeric: true },
      { key: 'rate', label: 'Attendance %', numeric: true },
    ],
    rows,
    totals: {
      class: 'All pupils', present: sum('present'), late: sum('late'), absent: sum('absent'), excused: sum('excused'), days,
      rate: days ? Math.round(((sum('present') + sum('late')) / days) * 100) : null,
    },
  };
}

// ---- Academic performance: each pupil's average, grade and position in class for a term ----
async function performance({ classId, termId }) {
  const term = await findTerm(termId);
  const classes = await classesFor(classId);
  const rows = [];
  for (const cls of classes) {
    const students = await Student.findAll({
      where: { SchoolClassId: cls.id, status: 'active' },
      include: [{ model: Score, where: { TermId: term.id }, required: false }],
    });
    const averages = {};
    for (const s of students) {
      if (s.Scores.length) {
        const totals = s.Scores.map((sc) => Number(sc.caScore) + Number(sc.examScore));
        averages[s.id] = round2(totals.reduce((a, b) => a + b, 0) / totals.length);
      }
    }
    const positions = rankPositions(averages);
    for (const s of students) {
      const avg = averages[s.id] ?? null;
      rows.push({
        class: classLabel(cls),
        admissionNo: s.admissionNo,
        pupil: `${s.lastName} ${s.firstName}`,
        subjects: s.Scores.length,
        total: round2(s.Scores.reduce((a, sc) => a + Number(sc.caScore) + Number(sc.examScore), 0)),
        average: avg,
        grade: avg === null ? null : gradeFor(avg).grade,
        position: positions[s.id] ? `${ordinal(positions[s.id])} of ${Object.keys(averages).length}` : null,
      });
    }
  }
  rows.sort((a, b) => a.class.localeCompare(b.class) || (b.average ?? -1) - (a.average ?? -1));
  const scored = rows.filter((r) => r.average !== null);
  return {
    title: 'Academic performance',
    subtitle: `${termLabel(term)}${classId ? ` · ${classLabel(classes[0])}` : ' · All classes'}`,
    columns: [
      { key: 'class', label: 'Class' },
      { key: 'admissionNo', label: 'Admission no.' },
      { key: 'pupil', label: 'Pupil' },
      { key: 'subjects', label: 'Subjects', numeric: true },
      { key: 'total', label: 'Total score', numeric: true },
      { key: 'average', label: 'Average', numeric: true },
      { key: 'grade', label: 'Grade' },
      { key: 'position', label: 'Position in class' },
    ],
    rows,
    totals: {
      class: 'All pupils',
      average: scored.length ? round2(scored.reduce((a, r) => a + r.average, 0) / scored.length) : null,
      grade: scored.length ? `${Math.round((scored.filter((r) => r.average >= 40).length / scored.length) * 100)}% passed` : null,
    },
  };
}

// ---- Fee collection: billed, paid and outstanding per pupil for a term ----
async function fees({ classId, termId }) {
  const term = await findTerm(termId);
  const students = await Student.findAll({
    where: { status: 'active', ...(classId && { SchoolClassId: classId }) },
    include: [SchoolClass],
  });
  const rows = [];
  for (const s of students) {
    const st = await statementFor(s, term.id);
    rows.push({
      class: classLabel(s.SchoolClass),
      admissionNo: s.admissionNo,
      pupil: `${s.lastName} ${s.firstName}`,
      billed: st.billed,
      paid: st.paid,
      balance: st.balance,
      status: st.billed === 0 ? 'No fees set' : st.balance <= 0 ? 'Paid' : st.paid > 0 ? 'Part paid' : 'Not paid',
    });
  }
  rows.sort(byClassThenName);
  const sum = (k) => round2(rows.reduce((a, r) => a + r[k], 0));
  return {
    title: 'Fee collection',
    subtitle: `${termLabel(term)}${classId ? ` · ${rows[0]?.class || ''}` : ' · All classes'}`,
    columns: [
      { key: 'class', label: 'Class' },
      { key: 'admissionNo', label: 'Admission no.' },
      { key: 'pupil', label: 'Pupil' },
      { key: 'billed', label: 'Billed (NGN)', numeric: true, money: true },
      { key: 'paid', label: 'Paid (NGN)', numeric: true, money: true },
      { key: 'balance', label: 'Balance (NGN)', numeric: true, money: true },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: {
      class: 'All pupils', billed: sum('billed'), paid: sum('paid'), balance: sum('balance'),
      status: `${rows.filter((r) => r.balance > 0).length} owing`,
    },
  };
}

const REPORTS = {
  enrolment: { build: enrolment, roles: ['admin', 'bursar'] },
  attendance: { build: attendance, roles: ['admin'] },
  performance: { build: performance, roles: ['admin'] },
  fees: { build: fees, roles: ['admin', 'bursar'] },
};

exports.list = (req, res) => {
  res.json(Object.entries(REPORTS).filter(([, r]) => r.roles.includes(req.user.role)).map(([key]) => key));
};

// GET /reports/:type?classId=&termId=&from=&to=&format=csv
exports.show = async (req, res) => {
  const report = REPORTS[req.params.type];
  if (!report) throw new HttpError(404, 'Unknown report');
  if (!report.roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to view this report');

  const { classId, termId, from, to, format } = req.query;
  const data = await report.build({ classId: classId ? Number(classId) : null, termId: termId ? Number(termId) : null, from, to });

  if (format === 'csv') {
    await audit(req, 'export_report', { report: req.params.type, rows: data.rows.length });
    const filename = `gvma-${req.params.type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    const rows = data.totals ? [...data.rows, data.totals] : data.rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(toCsv(data.columns, rows));
  }
  res.json(data);
};
