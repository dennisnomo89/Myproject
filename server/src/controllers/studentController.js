const { Op } = require('sequelize');
const { Student, SchoolClass, User, StudentParent } = require('../models');
const { HttpError } = require('../utils/httpError');
const { studentScope, assertCanAccessStudent } = require('../middleware/access');
const audit = require('../utils/audit');

const STUDENT_FIELDS = ['admissionNo', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'admissionDate', 'status'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const detailIncludes = [
  { model: SchoolClass, attributes: ['id', 'name', 'arm'] },
  { model: User, as: 'parents', attributes: ['id', 'fullName', 'email', 'phone'], through: { attributes: ['relationship'] } },
];

exports.list = async (req, res) => {
  const { q, classId, status = 'active' } = req.query;
  // Filters are combined with Op.and so they can narrow, but never replace, the role scope.
  const filters = [await studentScope(req.user)];
  if (status !== 'all') filters.push({ status });
  if (classId) filters.push({ SchoolClassId: classId });
  if (q) {
    filters.push({
      [Op.or]: [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { admissionNo: { [Op.like]: `%${q}%` } },
      ],
    });
  }
  const students = await Student.findAll({
    where: { [Op.and]: filters },
    include: [{ model: SchoolClass, attributes: ['id', 'name', 'arm'] }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
  res.json(students);
};

exports.get = async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.id);
  res.json(await Student.findByPk(req.params.id, { include: detailIncludes }));
};

async function resolveClassId(classId) {
  if (classId === undefined) return undefined;
  if (!classId) return null;
  if (!(await SchoolClass.findByPk(classId))) throw new HttpError(400, 'Class does not exist');
  return classId;
}

exports.create = async (req, res) => {
  const data = pick(req.body, STUDENT_FIELDS);
  const SchoolClassId = await resolveClassId(req.body.classId);
  const student = await Student.create({ ...data, SchoolClassId });
  await audit(req, 'create_student', { id: student.id, admissionNo: student.admissionNo });
  res.status(201).json(await Student.findByPk(student.id, { include: detailIncludes }));
};

exports.update = async (req, res) => {
  const student = await Student.findByPk(req.params.id);
  if (!student) throw new HttpError(404, 'Student not found');
  const SchoolClassId = await resolveClassId(req.body.classId);
  await student.update({ ...pick(req.body, STUDENT_FIELDS), ...(SchoolClassId !== undefined && { SchoolClassId }) });
  await audit(req, 'update_student', { id: student.id });
  res.json(await Student.findByPk(student.id, { include: detailIncludes }));
};

exports.linkParent = async (req, res) => {
  const { parentId, relationship } = req.body;
  const student = await Student.findByPk(req.params.id);
  const parent = await User.findByPk(parentId);
  if (!student) throw new HttpError(404, 'Student not found');
  if (!parent || parent.role !== 'parent') throw new HttpError(400, 'Selected user is not a parent account');
  const [link] = await StudentParent.findOrCreate({ where: { StudentId: student.id, parentId: parent.id } });
  await link.update({ relationship });
  await audit(req, 'link_parent', { studentId: student.id, parentId: parent.id });
  res.json(await Student.findByPk(student.id, { include: detailIncludes }));
};

exports.unlinkParent = async (req, res) => {
  await StudentParent.destroy({ where: { StudentId: req.params.id, parentId: req.params.parentId } });
  res.status(204).end();
};
