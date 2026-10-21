const {
  sequelize, Score, Student, Subject, Term, AcademicSession, SchoolClass, ClassSubject,
  Observation, ReportRemark, Attendance, User, MONTESSORI_AREAS,
} = require('../models');
const { Op } = require('sequelize');
const { HttpError } = require('../utils/httpError');
const { assertCanAccessClass, assertCanAccessStudent } = require('../middleware/access');
const { CA_MAX, EXAM_MAX, gradeFor, rankPositions, ordinal, round2 } = require('../utils/grading');
const audit = require('../utils/audit');

const RATINGS = ['emerging', 'developing', 'secure'];

async function getTerm(termId) {
  const term = await Term.findByPk(termId, { include: AcademicSession });
  if (!term) throw new HttpError(404, 'Term not found');
  return term;
}

// Teachers may enter scores for a subject only if they teach it in that class or are the class teacher.
async function assertCanEnterScores(user, classId, subjectId) {
  const cls = await assertCanAccessClass(user, classId);
  if (user.role === 'admin' || cls.classTeacherId === user.id) return cls;
  const teaches = await ClassSubject.findOne({ where: { SchoolClassId: classId, SubjectId: subjectId, teacherId: user.id } });
  if (!teaches) throw new HttpError(403, 'You do not teach this subject in this class');
  return cls;
}

// Score sheet for one class, subject and term.
exports.scoreSheet = async (req, res) => {
  const { classId, subjectId, termId } = req.query;
  if (!classId || !subjectId || !termId) throw new HttpError(400, 'classId, subjectId and termId are required');
  await assertCanEnterScores(req.user, classId, subjectId);

  const students = await Student.findAll({
    where: { SchoolClassId: classId, status: 'active' },
    include: [{ model: Score, where: { SubjectId: subjectId, TermId: termId }, required: false }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
  res.json({
    limits: { caMax: CA_MAX, examMax: EXAM_MAX },
    rows: students.map((s) => {
      const score = s.Scores[0];
      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        name: `${s.lastName} ${s.firstName}`,
        caScore: score ? Number(score.caScore) : null,
        examScore: score ? Number(score.examScore) : null,
        remark: score ? score.remark : '',
      };
    }),
  });
};

// Body: { classId, subjectId, termId, scores: [{ studentId, caScore, examScore, remark }] }
exports.saveScores = async (req, res) => {
  const { classId, subjectId, termId, scores } = req.body;
  if (!classId || !subjectId || !termId || !Array.isArray(scores)) {
    throw new HttpError(400, 'classId, subjectId, termId and scores are required');
  }
  await assertCanEnterScores(req.user, classId, subjectId);
  const term = await getTerm(termId);
  if (term.resultsPublished && req.user.role !== 'admin') {
    throw new HttpError(400, 'Results for this term are published. Ask an administrator to unpublish them first.');
  }

  const classStudentIds = new Set((await Student.findAll({ where: { SchoolClassId: classId }, attributes: ['id'] })).map((s) => s.id));
  for (const s of scores) {
    if (!classStudentIds.has(Number(s.studentId))) throw new HttpError(400, `Student ${s.studentId} is not in this class`);
    const ca = Number(s.caScore);
    const exam = Number(s.examScore);
    if (!(ca >= 0 && ca <= CA_MAX)) throw new HttpError(400, `CA score must be between 0 and ${CA_MAX}`);
    if (!(exam >= 0 && exam <= EXAM_MAX)) throw new HttpError(400, `Exam score must be between 0 and ${EXAM_MAX}`);
  }

  await sequelize.transaction(async (t) => {
    for (const s of scores) {
      const values = { caScore: Number(s.caScore), examScore: Number(s.examScore), remark: s.remark || null };
      const [row, created] = await Score.findOrCreate({
        where: { StudentId: s.studentId, SubjectId: subjectId, TermId: termId },
        defaults: values,
        transaction: t,
      });
      if (!created) await row.update(values, { transaction: t });
    }
  });
  await audit(req, 'save_scores', { classId, subjectId, termId, count: scores.length });
  res.json({ message: `Scores saved for ${scores.length} pupils` });
};

// Body: { termId, observations: [{ area, rating, comment }] }
exports.saveObservations = async (req, res) => {
  const student = await assertCanAccessStudent(req.user, req.params.studentId);
  if (req.user.role === 'parent') throw new HttpError(403, 'Parents cannot edit observations');
  const { termId, observations } = req.body;
  await getTerm(termId);
  if (!Array.isArray(observations)) throw new HttpError(400, 'observations must be a list');
  for (const o of observations) {
    if (!MONTESSORI_AREAS.includes(o.area)) throw new HttpError(400, `Invalid area "${o.area}"`);
    if (!RATINGS.includes(o.rating)) throw new HttpError(400, `Rating must be one of: ${RATINGS.join(', ')}`);
  }
  await sequelize.transaction(async (t) => {
    for (const o of observations) {
      const [row, created] = await Observation.findOrCreate({
        where: { StudentId: student.id, TermId: termId, area: o.area },
        defaults: { rating: o.rating, comment: o.comment },
        transaction: t,
      });
      if (!created) await row.update({ rating: o.rating, comment: o.comment }, { transaction: t });
    }
  });
  res.json({ message: 'Observations saved' });
};

// Body: { termId, teacherRemark?, headRemark? } — head remark is admin only.
exports.saveRemark = async (req, res) => {
  const student = await assertCanAccessStudent(req.user, req.params.studentId);
  if (req.user.role === 'parent') throw new HttpError(403, 'Parents cannot edit remarks');
  const { termId, teacherRemark, headRemark } = req.body;
  await getTerm(termId);
  if (headRemark !== undefined && req.user.role !== 'admin') throw new HttpError(403, 'Only the head can add the head remark');
  const [row] = await ReportRemark.findOrCreate({ where: { StudentId: student.id, TermId: termId } });
  await row.update({
    ...(teacherRemark !== undefined && { teacherRemark }),
    ...(headRemark !== undefined && { headRemark }),
  });
  res.json(row);
};

// Computes each pupil's average in a class for a term, used for positions.
async function classAverages(classId, termId) {
  const scores = await Score.findAll({
    where: { TermId: termId },
    include: [{ model: Student, where: { SchoolClassId: classId, status: 'active' }, attributes: [] }],
  });
  const totals = {};
  const bySubject = {};
  for (const s of scores) {
    const total = Number(s.caScore) + Number(s.examScore);
    (totals[s.StudentId] ||= []).push(total);
    (bySubject[s.SubjectId] ||= []).push(total);
  }
  const averages = Object.fromEntries(Object.entries(totals).map(([id, list]) => [id, round2(list.reduce((a, b) => a + b, 0) / list.length)]));
  const subjectAverages = Object.fromEntries(Object.entries(bySubject).map(([id, list]) => [id, round2(list.reduce((a, b) => a + b, 0) / list.length)]));
  return { averages, subjectAverages };
}

exports.reportCard = async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const term = await getTerm(req.query.termId);
  if (req.user.role === 'parent' && !term.resultsPublished) {
    throw new HttpError(403, 'Results for this term have not been published yet');
  }

  const student = await Student.findByPk(req.params.studentId, {
    include: [{ model: SchoolClass, include: [{ model: User, as: 'classTeacher', attributes: ['fullName'] }] }],
  });
  const [scores, observations, remark] = await Promise.all([
    Score.findAll({ where: { StudentId: student.id, TermId: term.id }, include: Subject, order: [[Subject, 'name', 'ASC']] }),
    Observation.findAll({ where: { StudentId: student.id, TermId: term.id } }),
    ReportRemark.findOne({ where: { StudentId: student.id, TermId: term.id } }),
  ]);

  let attendance = null;
  if (term.startDate && term.endDate) {
    const records = await Attendance.findAll({
      where: { StudentId: student.id, date: { [Op.between]: [term.startDate, term.endDate] } },
    });
    attendance = {
      total: records.length,
      present: records.filter((r) => ['present', 'late'].includes(r.status)).length,
    };
  }

  const { averages, subjectAverages } = student.SchoolClassId
    ? await classAverages(student.SchoolClassId, term.id)
    : { averages: {}, subjectAverages: {} };
  const positions = rankPositions(averages);

  const subjects = scores.map((s) => {
    const total = round2(Number(s.caScore) + Number(s.examScore));
    const g = gradeFor(total);
    return {
      subject: s.Subject.name,
      caScore: Number(s.caScore),
      examScore: Number(s.examScore),
      total,
      grade: g.grade,
      gradeRemark: g.remark,
      classAverage: subjectAverages[s.SubjectId] ?? null,
      teacherRemark: s.remark,
    };
  });
  const totalScore = round2(subjects.reduce((a, s) => a + s.total, 0));
  const average = subjects.length ? round2(totalScore / subjects.length) : null;
  const position = positions[student.id];

  res.json({
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      name: `${student.lastName} ${student.firstName}`,
      gender: student.gender,
      class: student.SchoolClass ? `${student.SchoolClass.name}${student.SchoolClass.arm ? ` ${student.SchoolClass.arm}` : ''}` : null,
      classTeacher: student.SchoolClass && student.SchoolClass.classTeacher ? student.SchoolClass.classTeacher.fullName : null,
    },
    term: { id: term.id, name: term.name, session: term.AcademicSession.name, published: term.resultsPublished },
    subjects,
    summary: {
      totalScore,
      average,
      grade: average !== null ? gradeFor(average).grade : null,
      position: position ? ordinal(position) : null,
      classSize: Object.keys(averages).length,
    },
    observations: observations.map((o) => ({ area: o.area, rating: o.rating, comment: o.comment })),
    attendance,
    remarks: { teacher: remark ? remark.teacherRemark : null, head: remark ? remark.headRemark : null },
  });
};

// Broadsheet: every pupil's totals per subject and position for a class and term.
exports.broadsheet = async (req, res) => {
  const { classId, termId } = req.query;
  if (!classId || !termId) throw new HttpError(400, 'classId and termId are required');
  await assertCanAccessClass(req.user, classId);
  await getTerm(termId);

  const students = await Student.findAll({
    where: { SchoolClassId: classId, status: 'active' },
    include: [{ model: Score, where: { TermId: termId }, required: false, include: Subject }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
  const { averages } = await classAverages(classId, termId);
  const positions = rankPositions(averages);
  const subjectNames = [...new Set(students.flatMap((s) => s.Scores.map((sc) => sc.Subject.name)))].sort();

  res.json({
    subjects: subjectNames,
    rows: students.map((s) => ({
      studentId: s.id,
      name: `${s.lastName} ${s.firstName}`,
      admissionNo: s.admissionNo,
      totals: Object.fromEntries(s.Scores.map((sc) => [sc.Subject.name, round2(Number(sc.caScore) + Number(sc.examScore))])),
      average: averages[s.id] ?? null,
      position: positions[s.id] ? ordinal(positions[s.id]) : null,
    })),
  });
};
