const { Op } = require('sequelize');
const {
  sequelize, Conversation, Message, User, Student, SchoolClass, ClassSubject, Subject,
} = require('../models');
const { HttpError } = require('../utils/httpError');
const { teacherClassIds, parentStudentIds } = require('../middleware/access');
const notifications = require('../utils/notifications');

const userAttrs = ['id', 'fullName', 'role'];
const classLabel = (c) => (c ? `${c.name}${c.arm ? ` ${c.arm}` : ''}` : null);
const pupil = (s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, class: classLabel(s.SchoolClass) });

// ---- Who may message whom ----

// For staff: parents they may contact, each with the pupils that connect them.
async function parentContacts(user) {
  const where = { status: 'active' };
  if (user.role === 'teacher') where.SchoolClassId = await teacherClassIds(user.id);
  const students = await Student.findAll({
    where,
    include: [SchoolClass, { model: User, as: 'parents', where: { isActive: true }, attributes: userAttrs, required: true }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
  const byParent = new Map();
  for (const s of students) {
    for (const p of s.parents) {
      if (!byParent.has(p.id)) byParent.set(p.id, { user: p.toJSON(), students: [], reason: null });
      byParent.get(p.id).students.push(pupil(s));
    }
  }
  for (const c of byParent.values()) c.reason = `Parent of ${c.students.map((s) => s.name).join(', ')}`;
  return [...byParent.values()].sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));
}

// For parents: their children's class and subject teachers, plus the school office.
async function staffContacts(user) {
  const children = await Student.findAll({ where: { id: await parentStudentIds(user.id), status: 'active' }, include: [SchoolClass] });
  const contacts = new Map();
  const add = (staff, reason, student) => {
    if (!staff || !staff.isActive) return;
    if (!contacts.has(staff.id)) contacts.set(staff.id, { user: { id: staff.id, fullName: staff.fullName, role: staff.role }, reasons: [], students: [] });
    const c = contacts.get(staff.id);
    if (!c.reasons.includes(reason)) c.reasons.push(reason);
    if (student && !c.students.some((s) => s.id === student.id)) c.students.push(pupil(student));
  };
  for (const child of children) {
    if (!child.SchoolClassId) continue;
    const cls = await SchoolClass.findByPk(child.SchoolClassId, { include: [{ model: User, as: 'classTeacher' }] });
    add(cls.classTeacher, `${child.firstName}'s class teacher`, child);
    const subjects = await ClassSubject.findAll({ where: { SchoolClassId: cls.id }, include: [Subject, { model: User, as: 'teacher' }] });
    for (const cs of subjects) add(cs.teacher, `${child.firstName}'s ${cs.Subject.name} teacher`, child);
  }
  const office = await User.findAll({ where: { role: { [Op.in]: ['admin', 'bursar'] }, isActive: true } });
  for (const o of office) add(o, o.role === 'admin' ? 'School administration' : 'Bursar (fees)', null);
  return [...contacts.values()]
    .map((c) => ({ user: c.user, students: c.students, reason: c.reasons.join('; ') }))
    .sort((a, b) => (a.user.role === 'teacher' ? 0 : 1) - (b.user.role === 'teacher' ? 0 : 1) || a.user.fullName.localeCompare(b.user.fullName));
}

const contactsFor = (user) => (user.role === 'parent' ? staffContacts(user) : parentContacts(user));

exports.contacts = async (req, res) => {
  res.json(await contactsFor(req.user));
};

// ---- Conversations ----

const isParentSide = (user, conv) => conv.parentId === user.id;
const myLastRead = (user, conv) => (isParentSide(user, conv) ? conv.parentLastReadAt : conv.staffLastReadAt);
const readField = (user, conv) => (isParentSide(user, conv) ? 'parentLastReadAt' : 'staffLastReadAt');

async function unreadIn(user, conv) {
  const lastRead = myLastRead(user, conv);
  return Message.count({
    where: {
      ConversationId: conv.id,
      senderId: { [Op.ne]: user.id },
      ...(lastRead && { createdAt: { [Op.gt]: lastRead } }),
    },
  });
}

const participantWhere = (user) => ({ [Op.or]: [{ parentId: user.id }, { staffId: user.id }] });

const convIncludes = [
  { model: User, as: 'parent', attributes: userAttrs },
  { model: User, as: 'staff', attributes: userAttrs },
  { model: Student, attributes: ['id', 'firstName', 'lastName'], include: [{ model: SchoolClass, attributes: ['name', 'arm'] }] },
];

async function summary(user, conv) {
  const last = await Message.findOne({ where: { ConversationId: conv.id }, order: [['id', 'DESC']] });
  const other = isParentSide(user, conv) ? conv.staff : conv.parent;
  return {
    id: conv.id,
    subject: conv.subject,
    with: other,
    student: conv.Student ? pupil(conv.Student) : null,
    lastMessageAt: conv.lastMessageAt,
    lastMessage: last ? { body: last.body.slice(0, 140), fromMe: last.senderId === user.id } : null,
    unread: await unreadIn(user, conv),
  };
}

exports.listConversations = async (req, res) => {
  const convs = await Conversation.findAll({ where: participantWhere(req.user), include: convIncludes, order: [['lastMessageAt', 'DESC']] });
  res.json(await Promise.all(convs.map((c) => summary(req.user, c))));
};

exports.unreadCount = async (req, res) => {
  const convs = await Conversation.findAll({ where: participantWhere(req.user) });
  const counts = await Promise.all(convs.map((c) => unreadIn(req.user, c)));
  res.json({ unread: counts.reduce((a, b) => a + b, 0) });
};

async function loadOwnConversation(user, id) {
  const conv = await Conversation.findOne({ where: { id, ...participantWhere(user) }, include: convIncludes });
  if (!conv) throw new HttpError(404, 'Conversation not found');
  return conv;
}

exports.getConversation = async (req, res) => {
  const conv = await loadOwnConversation(req.user, req.params.id);
  const messages = await Message.findAll({
    where: { ConversationId: conv.id },
    include: [{ model: User, as: 'sender', attributes: userAttrs }],
    order: [['id', 'ASC']],
  });
  const result = { ...(await summary(req.user, conv)), messages: messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, sender: m.sender, fromMe: m.senderId === req.user.id })) };
  await conv.update({ [readField(req.user, conv)]: new Date() });
  res.json({ ...result, unread: 0 });
};

const cleanBody = (body) => {
  const text = (body || '').trim();
  if (!text) throw new HttpError(400, 'Message cannot be empty');
  if (text.length > 5000) throw new HttpError(400, 'Message is too long (5000 characters maximum)');
  return text;
};

// Body: { recipientId, subject, body, studentId? }
exports.startConversation = async (req, res) => {
  const { recipientId, studentId } = req.body;
  const subject = (req.body.subject || '').trim();
  const body = cleanBody(req.body.body);
  if (!subject) throw new HttpError(400, 'Subject is required');

  const contact = (await contactsFor(req.user)).find((c) => c.user.id === Number(recipientId));
  if (!contact) throw new HttpError(403, 'You cannot message this person');
  if (studentId && !contact.students.some((s) => s.id === Number(studentId))) {
    // Office staff (admin/bursar) have no pupil list for parents, so allow any of the parent's own children.
    const ok = req.user.role === 'parent' && contact.students.length === 0 && (await parentStudentIds(req.user.id)).includes(Number(studentId));
    if (!ok) throw new HttpError(400, 'That pupil is not linked to this conversation');
  }

  const now = new Date();
  const parentSide = req.user.role === 'parent';
  const conv = await sequelize.transaction(async (t) => {
    const c = await Conversation.create({
      subject: subject.slice(0, 150),
      parentId: parentSide ? req.user.id : contact.user.id,
      staffId: parentSide ? contact.user.id : req.user.id,
      StudentId: studentId || null,
      lastMessageAt: now,
      [parentSide ? 'parentLastReadAt' : 'staffLastReadAt']: now,
    }, { transaction: t });
    await Message.create({ ConversationId: c.id, senderId: req.user.id, body }, { transaction: t });
    return c;
  });
  notifications.newMessage({ conversationId: conv.id, senderId: req.user.id, recipientId: contact.user.id, body });
  res.status(201).json(await summary(req.user, await loadOwnConversation(req.user, conv.id)));
};

// Body: { body }
exports.reply = async (req, res) => {
  const conv = await loadOwnConversation(req.user, req.params.id);
  const body = cleanBody(req.body.body);
  const recipient = isParentSide(req.user, conv) ? conv.staff : conv.parent;
  const recipientUser = await User.findByPk(recipient.id);
  if (!recipientUser || !recipientUser.isActive) throw new HttpError(400, 'This account is no longer active, so the message cannot be delivered');

  const now = new Date();
  const message = await Message.create({ ConversationId: conv.id, senderId: req.user.id, body });
  await conv.update({ lastMessageAt: now, [readField(req.user, conv)]: now });
  notifications.newMessage({ conversationId: conv.id, senderId: req.user.id, recipientId: recipient.id, body });
  res.status(201).json({ id: message.id, body: message.body, createdAt: message.createdAt, fromMe: true, sender: { id: req.user.id, fullName: req.user.fullName, role: req.user.role } });
};

