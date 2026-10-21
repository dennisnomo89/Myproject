const { Op } = require('sequelize');
const { SchoolClass, ClassSubject, StudentParent, Student } = require('../models');
const { HttpError } = require('../utils/httpError');

// IDs of classes a teacher is responsible for: class teacher or subject teacher.
async function teacherClassIds(userId) {
  const [home, subjects] = await Promise.all([
    SchoolClass.findAll({ where: { classTeacherId: userId }, attributes: ['id'] }),
    ClassSubject.findAll({ where: { teacherId: userId }, attributes: ['SchoolClassId'] }),
  ]);
  return [...new Set([...home.map((c) => c.id), ...subjects.map((s) => s.SchoolClassId)])];
}

async function parentStudentIds(userId) {
  const links = await StudentParent.findAll({ where: { parentId: userId }, attributes: ['StudentId'] });
  return links.map((l) => l.StudentId);
}

// Sequelize `where` clause restricting students to those the user may see.
async function studentScope(user) {
  if (['admin', 'bursar'].includes(user.role)) return {};
  if (user.role === 'teacher') return { SchoolClassId: { [Op.in]: await teacherClassIds(user.id) } };
  return { id: { [Op.in]: await parentStudentIds(user.id) } };
}

async function assertCanAccessStudent(user, studentId) {
  // Op.and keeps the scope's own `id` condition (parents) from overwriting the requested id.
  const student = await Student.findOne({ where: { [Op.and]: [{ id: studentId }, await studentScope(user)] } });
  if (!student) throw new HttpError(404, 'Student not found');
  return student;
}

async function assertCanAccessClass(user, classId) {
  const cls = await SchoolClass.findByPk(classId);
  if (!cls) throw new HttpError(404, 'Class not found');
  if (user.role === 'admin') return cls;
  if (user.role === 'teacher' && (await teacherClassIds(user.id)).includes(cls.id)) return cls;
  throw new HttpError(403, 'You are not assigned to this class');
}

module.exports = { teacherClassIds, parentStudentIds, studentScope, assertCanAccessStudent, assertCanAccessClass };
