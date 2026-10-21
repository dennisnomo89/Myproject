const { Op } = require('sequelize');
const {
  Student, User, SchoolClass, Attendance, Payment, Term, AuditLog, Announcement, EmailLog,
  SchoolEvent, TimetableSlot, ClassSubject, Subject,
} = require('../models');
const { isLive } = require('../utils/mailer');
const { teacherClassIds, parentStudentIds } = require('../middleware/access');

const today = () => new Date().toISOString().slice(0, 10);

exports.summary = async (req, res) => {
  const { role, id } = req.user;
  const term = await Term.findOne({ where: { isCurrent: true } });
  const audienceFor = role === 'parent' ? ['all', 'parents'] : ['all', 'staff'];
  const latestAnnouncements = await Announcement.findAll({
    where: role === 'admin' ? {} : { audience: { [Op.in]: audienceFor } },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });
  const upcomingEvents = await SchoolEvent.findAll({
    where: {
      audience: { [Op.in]: role === 'admin' ? ['all', 'staff', 'parents'] : audienceFor },
      endDate: { [Op.gte]: today() },
    },
    order: [['startDate', 'ASC']],
    limit: 5,
  });
  const base = { role, currentTerm: term, latestAnnouncements, upcomingEvents };

  if (role === 'admin' || role === 'bursar') {
    const [students, teachers, parents, classes, presentToday, markedToday, collected] = await Promise.all([
      Student.count({ where: { status: 'active' } }),
      User.count({ where: { role: 'teacher', isActive: true } }),
      User.count({ where: { role: 'parent', isActive: true } }),
      SchoolClass.count(),
      Attendance.count({ where: { date: today(), status: { [Op.in]: ['present', 'late'] } } }),
      Attendance.count({ where: { date: today() } }),
      term ? Payment.sum('amount', { where: { TermId: term.id } }) : 0,
    ]);
    const recentActivity = role === 'admin'
      ? await AuditLog.findAll({ include: [{ model: User, attributes: ['fullName'] }], order: [['createdAt', 'DESC']], limit: 10 })
      : [];
    return res.json({
      ...base,
      stats: { students, teachers, parents, classes, presentToday, markedToday, feesCollectedThisTerm: Number(collected) || 0 },
      recentActivity,
    });
  }

  if (role === 'teacher') {
    const classIds = await teacherClassIds(id);
    const classes = await SchoolClass.findAll({ where: { id: classIds } });
    const counts = await Student.count({ where: { SchoolClassId: classIds, status: 'active' }, group: ['SchoolClassId'] });
    const marked = await Attendance.findAll({
      where: { date: today() },
      include: [{ model: Student, where: { SchoolClassId: classIds }, attributes: ['SchoolClassId'] }],
      attributes: ['id'],
    });
    const markedClassIds = new Set(marked.map((m) => m.Student.SchoolClassId));

    // Lessons this teacher teaches today (empty at weekends).
    const weekday = new Date().getDay();
    const links = await ClassSubject.findAll({ where: { teacherId: id } });
    const todaysLessons = weekday >= 1 && weekday <= 5 && links.length
      ? await TimetableSlot.findAll({
        where: { day: weekday, [Op.or]: links.map((l) => ({ SchoolClassId: l.SchoolClassId, SubjectId: l.SubjectId })) },
        include: [Subject, SchoolClass],
        order: [['startTime', 'ASC']],
      })
      : [];

    return res.json({
      ...base,
      todaysLessons: todaysLessons.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.Subject.name,
        class: `${s.SchoolClass.name}${s.SchoolClass.arm ? ` ${s.SchoolClass.arm}` : ''}`,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: `${c.name}${c.arm ? ` ${c.arm}` : ''}`,
        isClassTeacher: c.classTeacherId === id,
        students: (counts.find((x) => x.SchoolClassId === c.id) || { count: 0 }).count,
        attendanceTakenToday: markedClassIds.has(c.id),
      })),
    });
  }

  // Parent
  const children = await Student.findAll({ where: { id: await parentStudentIds(id) }, include: [SchoolClass] });
  res.json({
    ...base,
    children: children.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      admissionNo: c.admissionNo,
      class: c.SchoolClass ? `${c.SchoolClass.name}${c.SchoolClass.arm ? ` ${c.SchoolClass.arm}` : ''}` : null,
    })),
  });
};

exports.emailLog = async (req, res) => {
  const { event, status } = req.query;
  const where = {};
  if (event) where.event = event;
  if (status) where.status = status;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({
    mode: isLive ? 'smtp' : 'log',
    emails: await EmailLog.findAll({ where, order: [['id', 'DESC']], limit }),
  });
};

exports.auditLog = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await AuditLog.findAll({
    include: [{ model: User, attributes: ['fullName', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit,
  }));
};
