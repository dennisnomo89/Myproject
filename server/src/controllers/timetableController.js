const { Op } = require('sequelize');
const {
  TimetableSlot, SchoolClass, Subject, ClassSubject, User, Student, SchoolEvent, EVENT_CATEGORIES,
} = require('../models');
const { HttpError } = require('../utils/httpError');
const { teacherClassIds, parentStudentIds } = require('../middleware/access');
const audit = require('../utils/audit');

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// ---- Timetable ----

// Classes whose timetable the user may see.
async function viewableClassIds(user) {
  if (['admin', 'bursar'].includes(user.role)) return null; // all
  if (user.role === 'teacher') return teacherClassIds(user.id);
  const children = await Student.findAll({ where: { id: await parentStudentIds(user.id) }, attributes: ['SchoolClassId'] });
  return [...new Set(children.map((c) => c.SchoolClassId).filter(Boolean))];
}

// Map of "classId:subjectId" -> teacher, used to show who teaches each slot.
async function teacherMap(classIds) {
  const links = await ClassSubject.findAll({
    where: classIds ? { SchoolClassId: classIds } : {},
    include: [{ model: User, as: 'teacher', attributes: ['id', 'fullName'] }],
  });
  return Object.fromEntries(links.map((l) => [`${l.SchoolClassId}:${l.SubjectId}`, l.teacher]));
}

const slotJson = (slot, teachers) => ({
  id: slot.id,
  classId: slot.SchoolClassId,
  class: slot.SchoolClass ? `${slot.SchoolClass.name}${slot.SchoolClass.arm ? ` ${slot.SchoolClass.arm}` : ''}` : undefined,
  day: slot.day,
  dayName: DAYS[slot.day],
  startTime: slot.startTime,
  endTime: slot.endTime,
  subjectId: slot.SubjectId,
  subject: slot.Subject ? slot.Subject.name : null,
  label: slot.label,
  teacher: slot.SubjectId ? teachers[`${slot.SchoolClassId}:${slot.SubjectId}`] || null : null,
});

const ORDER = [['day', 'ASC'], ['startTime', 'ASC']];

exports.classTimetable = async (req, res) => {
  const classId = Number(req.query.classId);
  if (!classId) throw new HttpError(400, 'classId is required');
  const allowed = await viewableClassIds(req.user);
  if (allowed && !allowed.includes(classId)) throw new HttpError(403, 'You cannot view this class timetable');
  const slots = await TimetableSlot.findAll({ where: { SchoolClassId: classId }, include: [Subject], order: ORDER });
  const teachers = await teacherMap([classId]);
  res.json(slots.map((s) => slotJson(s, teachers)));
};

// A teacher's own week across all the classes they teach.
exports.mySchedule = async (req, res) => {
  const links = await ClassSubject.findAll({ where: { teacherId: req.user.id } });
  if (!links.length) return res.json([]);
  const slots = await TimetableSlot.findAll({
    where: { [Op.or]: links.map((l) => ({ SchoolClassId: l.SchoolClassId, SubjectId: l.SubjectId })) },
    include: [Subject, SchoolClass],
    order: ORDER,
  });
  const teachers = await teacherMap(null);
  res.json(slots.map((s) => slotJson(s, teachers)));
};

const overlaps = (a, b) => a.startTime < b.endTime && a.endTime > b.startTime;

// Validates a slot and returns the values to save. `existing` is the slot being edited, if any.
async function validateSlot(body, existing) {
  const v = {
    SchoolClassId: Number(body.classId ?? existing?.SchoolClassId),
    day: Number(body.day ?? existing?.day),
    startTime: body.startTime ?? existing?.startTime,
    endTime: body.endTime ?? existing?.endTime,
    SubjectId: body.subjectId !== undefined ? (body.subjectId ? Number(body.subjectId) : null) : existing?.SubjectId ?? null,
    label: body.label !== undefined ? (body.label || '').trim() || null : existing?.label ?? null,
  };
  if (!(await SchoolClass.findByPk(v.SchoolClassId))) throw new HttpError(400, 'Class does not exist');
  if (!(v.day >= 1 && v.day <= 5)) throw new HttpError(400, 'Day must be Monday to Friday (1–5)');
  if (!v.startTime || !v.endTime || v.startTime >= v.endTime) throw new HttpError(400, 'End time must be after start time');
  if (!v.SubjectId && !v.label) throw new HttpError(400, 'Choose a subject or enter a label such as "Break"');

  let teacherId = null;
  if (v.SubjectId) {
    const link = await ClassSubject.findOne({ where: { SchoolClassId: v.SchoolClassId, SubjectId: v.SubjectId } });
    if (!link) throw new HttpError(400, 'This subject is not offered in this class. Add it on the Classes page first.');
    teacherId = link.teacherId;
  }

  const sameDay = await TimetableSlot.findAll({
    where: { day: v.day, ...(existing && { id: { [Op.ne]: existing.id } }) },
    include: [Subject, SchoolClass],
  });
  const clash = sameDay.find((s) => s.SchoolClassId === v.SchoolClassId && overlaps(s, v));
  if (clash) {
    throw new HttpError(409, `This overlaps ${clash.Subject ? clash.Subject.name : clash.label} (${clash.startTime}–${clash.endTime}) on ${DAYS[v.day]}`);
  }

  // The same teacher cannot be in two classes at once.
  if (teacherId) {
    const teachers = await teacherMap(null);
    const busy = sameDay.find((s) => s.SchoolClassId !== v.SchoolClassId && s.SubjectId
      && teachers[`${s.SchoolClassId}:${s.SubjectId}`]?.id === teacherId && overlaps(s, v));
    if (busy) {
      const who = teachers[`${busy.SchoolClassId}:${busy.SubjectId}`].fullName;
      throw new HttpError(409, `${who} is already teaching ${busy.Subject.name} in ${busy.SchoolClass.name}${busy.SchoolClass.arm ? ` ${busy.SchoolClass.arm}` : ''} at ${busy.startTime}–${busy.endTime} on ${DAYS[v.day]}`);
    }
  }
  return v;
}

exports.createSlot = async (req, res) => {
  const slot = await TimetableSlot.create(await validateSlot(req.body));
  await audit(req, 'create_timetable_slot', { id: slot.id, classId: slot.SchoolClassId, day: slot.day, startTime: slot.startTime });
  const full = await TimetableSlot.findByPk(slot.id, { include: [Subject] });
  res.status(201).json(slotJson(full, await teacherMap([slot.SchoolClassId])));
};

exports.updateSlot = async (req, res) => {
  const slot = await TimetableSlot.findByPk(req.params.id);
  if (!slot) throw new HttpError(404, 'Timetable slot not found');
  await slot.update(await validateSlot(req.body, slot));
  const full = await TimetableSlot.findByPk(slot.id, { include: [Subject] });
  res.json(slotJson(full, await teacherMap([slot.SchoolClassId])));
};

exports.deleteSlot = async (req, res) => {
  const slot = await TimetableSlot.findByPk(req.params.id);
  if (!slot) throw new HttpError(404, 'Timetable slot not found');
  await slot.destroy();
  await audit(req, 'delete_timetable_slot', { id: slot.id });
  res.status(204).end();
};

// ---- Events calendar ----

const visibleAudiences = (role) => (role === 'admin' ? ['all', 'staff', 'parents'] : role === 'parent' ? ['all', 'parents'] : ['all', 'staff']);

// Events overlapping [from, to]. Defaults to the next 60 days.
exports.listEvents = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = isDate(req.query.from) ? req.query.from : today;
  const to = isDate(req.query.to) ? req.query.to : new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  res.json(await SchoolEvent.findAll({
    where: {
      audience: { [Op.in]: visibleAudiences(req.user.role) },
      startDate: { [Op.lte]: to },
      endDate: { [Op.gte]: from },
    },
    order: [['startDate', 'ASC'], ['title', 'ASC']],
  }));
};

function eventValues(body, existing = {}) {
  const v = {
    title: (body.title ?? existing.title ?? '').trim(),
    description: body.description ?? existing.description ?? null,
    category: body.category ?? existing.category ?? 'other',
    audience: body.audience ?? existing.audience ?? 'all',
    startDate: body.startDate ?? existing.startDate,
    endDate: body.endDate || body.startDate || existing.endDate,
  };
  if (!v.title) throw new HttpError(400, 'Title is required');
  if (!EVENT_CATEGORIES.includes(v.category)) throw new HttpError(400, `Category must be one of: ${EVENT_CATEGORIES.join(', ')}`);
  if (!isDate(v.startDate) || !isDate(v.endDate)) throw new HttpError(400, 'Valid start and end dates are required');
  if (v.endDate < v.startDate) throw new HttpError(400, 'End date cannot be before start date');
  return v;
}

exports.createEvent = async (req, res) => {
  const event = await SchoolEvent.create({ ...eventValues(req.body), createdById: req.user.id });
  await audit(req, 'create_event', { id: event.id, title: event.title, startDate: event.startDate });
  res.status(201).json(event);
};

exports.updateEvent = async (req, res) => {
  const event = await SchoolEvent.findByPk(req.params.id);
  if (!event) throw new HttpError(404, 'Event not found');
  await event.update(eventValues(req.body, event.toJSON()));
  res.json(event);
};

exports.deleteEvent = async (req, res) => {
  const event = await SchoolEvent.findByPk(req.params.id);
  if (!event) throw new HttpError(404, 'Event not found');
  await event.destroy();
  await audit(req, 'delete_event', { id: event.id, title: event.title });
  res.status(204).end();
};

exports.DAYS = DAYS;
