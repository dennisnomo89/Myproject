const { sequelize, AcademicSession, Term, SchoolClass, Subject, ClassSubject, User, Student } = require('../models');
const { HttpError } = require('../utils/httpError');
const { teacherClassIds } = require('../middleware/access');
const audit = require('../utils/audit');
const notifications = require('../utils/notifications');

// ---- Sessions and terms ----

exports.listSessions = async (req, res) => {
  res.json(await AcademicSession.findAll({ include: Term, order: [['name', 'DESC'], [Term, 'id', 'ASC']] }));
};

exports.createSession = async (req, res) => {
  const { name, terms = ['First', 'Second', 'Third'] } = req.body;
  const session = await sequelize.transaction(async (t) => {
    const s = await AcademicSession.create({ name }, { transaction: t });
    await Term.bulkCreate(terms.map((n) => ({ name: n, AcademicSessionId: s.id })), { transaction: t });
    return s;
  });
  await audit(req, 'create_session', { name });
  res.status(201).json(await AcademicSession.findByPk(session.id, { include: Term }));
};

exports.currentTerm = async (req, res) => {
  const term = await Term.findOne({ where: { isCurrent: true }, include: AcademicSession });
  res.json(term);
};

// Marks a term (and its session) as current, clearing the flag everywhere else.
exports.setCurrentTerm = async (req, res) => {
  const term = await Term.findByPk(req.params.id);
  if (!term) throw new HttpError(404, 'Term not found');
  await sequelize.transaction(async (t) => {
    await Term.update({ isCurrent: false }, { where: {}, transaction: t });
    await AcademicSession.update({ isCurrent: false }, { where: {}, transaction: t });
    await term.update({ isCurrent: true }, { transaction: t });
    await AcademicSession.update({ isCurrent: true }, { where: { id: term.AcademicSessionId }, transaction: t });
  });
  await audit(req, 'set_current_term', { termId: term.id });
  res.json(await Term.findByPk(term.id, { include: AcademicSession }));
};

exports.updateTerm = async (req, res) => {
  const term = await Term.findByPk(req.params.id);
  if (!term) throw new HttpError(404, 'Term not found');
  const { startDate, endDate, resultsPublished } = req.body;
  const newlyPublished = Boolean(resultsPublished) && !term.resultsPublished;
  await term.update({
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(resultsPublished !== undefined && { resultsPublished: Boolean(resultsPublished) }),
  });
  if (resultsPublished !== undefined) {
    await audit(req, resultsPublished ? 'publish_results' : 'unpublish_results', { termId: term.id });
  }
  if (newlyPublished) notifications.resultsPublished(term.id);
  res.json(term);
};

// ---- Classes ----

const classIncludes = [
  { model: User, as: 'classTeacher', attributes: ['id', 'fullName'] },
  { model: ClassSubject, include: [Subject, { model: User, as: 'teacher', attributes: ['id', 'fullName'] }] },
];

exports.listClasses = async (req, res) => {
  const where = {};
  if (req.user.role === 'teacher') where.id = await teacherClassIds(req.user.id);
  const classes = await SchoolClass.findAll({ where, include: classIncludes, order: [['name', 'ASC'], ['arm', 'ASC']] });
  const counts = await Student.count({ where: { status: 'active' }, group: ['SchoolClassId'] });
  const byClass = Object.fromEntries(counts.map((c) => [c.SchoolClassId, c.count]));
  res.json(classes.map((c) => ({ ...c.toJSON(), studentCount: byClass[c.id] || 0 })));
};

async function assertTeacher(id) {
  if (!id) return;
  const user = await User.findByPk(id);
  if (!user || user.role !== 'teacher') throw new HttpError(400, 'Selected class teacher is not a teacher');
}

exports.createClass = async (req, res) => {
  const { name, arm, classTeacherId } = req.body;
  await assertTeacher(classTeacherId);
  const cls = await SchoolClass.create({ name, arm, classTeacherId: classTeacherId || null });
  await audit(req, 'create_class', { id: cls.id, name });
  res.status(201).json(await SchoolClass.findByPk(cls.id, { include: classIncludes }));
};

exports.updateClass = async (req, res) => {
  const cls = await SchoolClass.findByPk(req.params.id);
  if (!cls) throw new HttpError(404, 'Class not found');
  const { name, arm, classTeacherId } = req.body;
  await assertTeacher(classTeacherId);
  await cls.update({
    ...(name !== undefined && { name }),
    ...(arm !== undefined && { arm }),
    ...(classTeacherId !== undefined && { classTeacherId: classTeacherId || null }),
  });
  res.json(await SchoolClass.findByPk(cls.id, { include: classIncludes }));
};

exports.deleteClass = async (req, res) => {
  const cls = await SchoolClass.findByPk(req.params.id);
  if (!cls) throw new HttpError(404, 'Class not found');
  if (await Student.count({ where: { SchoolClassId: cls.id } })) {
    throw new HttpError(400, 'Move or remove the students in this class before deleting it');
  }
  await cls.destroy();
  await audit(req, 'delete_class', { id: cls.id, name: cls.name });
  res.status(204).end();
};

// Assign (or re-assign the teacher of) a subject for a class.
exports.assignSubject = async (req, res) => {
  const { subjectId, teacherId } = req.body;
  const cls = await SchoolClass.findByPk(req.params.id);
  const subject = await Subject.findByPk(subjectId);
  if (!cls || !subject) throw new HttpError(404, 'Class or subject not found');
  await assertTeacher(teacherId);
  const [link] = await ClassSubject.findOrCreate({ where: { SchoolClassId: cls.id, SubjectId: subject.id } });
  await link.update({ teacherId: teacherId || null });
  res.json(await SchoolClass.findByPk(cls.id, { include: classIncludes }));
};

exports.removeSubject = async (req, res) => {
  await ClassSubject.destroy({ where: { SchoolClassId: req.params.id, SubjectId: req.params.subjectId } });
  res.status(204).end();
};

// ---- Subjects ----

exports.listSubjects = async (req, res) => {
  res.json(await Subject.findAll({ order: [['name', 'ASC']] }));
};

exports.createSubject = async (req, res) => {
  res.status(201).json(await Subject.create({ name: (req.body.name || '').trim() }));
};

exports.deleteSubject = async (req, res) => {
  const subject = await Subject.findByPk(req.params.id);
  if (!subject) throw new HttpError(404, 'Subject not found');
  await subject.destroy();
  res.status(204).end();
};
