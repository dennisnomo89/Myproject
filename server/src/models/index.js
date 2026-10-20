const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ROLES = ['admin', 'teacher', 'bursar', 'parent'];
const MONTESSORI_AREAS = ['practical_life', 'sensorial', 'language', 'mathematics', 'culture'];

const User = sequelize.define('User', {
  fullName: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(120), allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM(...ROLES), allowNull: false },
  phone: DataTypes.STRING(20),
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  emailNotifications: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  defaultScope: { attributes: { exclude: ['passwordHash'] } },
  scopes: { withPassword: { attributes: {} } },
});

const AcademicSession = sequelize.define('AcademicSession', {
  name: { type: DataTypes.STRING(20), allowNull: false, unique: true }, // e.g. 2026/2027
  isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

const Term = sequelize.define('Term', {
  name: { type: DataTypes.STRING(20), allowNull: false }, // First, Second, Third
  startDate: DataTypes.DATEONLY,
  endDate: DataTypes.DATEONLY,
  isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  resultsPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

const SchoolClass = sequelize.define('SchoolClass', {
  name: { type: DataTypes.STRING(50), allowNull: false }, // e.g. Nursery 1, Primary 3
  arm: DataTypes.STRING(10),
}, { tableName: 'classes' });

const Subject = sequelize.define('Subject', {
  name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
});

const ClassSubject = sequelize.define('ClassSubject', {}, {
  tableName: 'class_subjects',
  indexes: [{ unique: true, fields: ['SchoolClassId', 'SubjectId'] }],
});

const Student = sequelize.define('Student', {
  admissionNo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  firstName: { type: DataTypes.STRING(60), allowNull: false },
  lastName: { type: DataTypes.STRING(60), allowNull: false },
  gender: { type: DataTypes.ENUM('male', 'female'), allowNull: false },
  dateOfBirth: DataTypes.DATEONLY,
  admissionDate: DataTypes.DATEONLY,
  status: { type: DataTypes.ENUM('active', 'graduated', 'withdrawn'), allowNull: false, defaultValue: 'active' },
});

const StudentParent = sequelize.define('StudentParent', {
  relationship: DataTypes.STRING(30),
}, { tableName: 'student_parents' });

const Attendance = sequelize.define('Attendance', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('present', 'absent', 'late', 'excused'), allowNull: false },
}, { tableName: 'attendance', indexes: [{ unique: true, fields: ['StudentId', 'date'] }] });

const Score = sequelize.define('Score', {
  caScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  examScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  remark: DataTypes.STRING,
}, { indexes: [{ unique: true, fields: ['StudentId', 'SubjectId', 'TermId'] }] });

const Observation = sequelize.define('Observation', {
  area: { type: DataTypes.ENUM(...MONTESSORI_AREAS), allowNull: false },
  rating: { type: DataTypes.ENUM('emerging', 'developing', 'secure'), allowNull: false },
  comment: DataTypes.TEXT,
}, { indexes: [{ unique: true, fields: ['StudentId', 'TermId', 'area'] }] });

const ReportRemark = sequelize.define('ReportRemark', {
  teacherRemark: DataTypes.TEXT,
  headRemark: DataTypes.TEXT,
}, { indexes: [{ unique: true, fields: ['StudentId', 'TermId'] }] });

const FeeItem = sequelize.define('FeeItem', {
  description: { type: DataTypes.STRING(100), allowNull: false }, // e.g. Tuition, Uniform
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
});

const Payment = sequelize.define('Payment', {
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } },
  method: { type: DataTypes.ENUM('cash', 'transfer', 'pos'), allowNull: false },
  receiptNo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  paidOn: { type: DataTypes.DATEONLY, allowNull: false },
});

const Announcement = sequelize.define('Announcement', {
  title: { type: DataTypes.STRING(150), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  audience: { type: DataTypes.ENUM('all', 'staff', 'parents'), allowNull: false, defaultValue: 'all' },
});

const AuditLog = sequelize.define('AuditLog', {
  action: { type: DataTypes.STRING(100), allowNull: false },
  details: DataTypes.TEXT,
}, { updatedAt: false });

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM, 24-hour

// One period in a class's weekly timetable. A slot has either a subject or a label (e.g. "Break").
const TimetableSlot = sequelize.define('TimetableSlot', {
  day: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } }, // 1 = Monday … 5 = Friday
  startTime: { type: DataTypes.STRING(5), allowNull: false, validate: { is: TIME } },
  endTime: { type: DataTypes.STRING(5), allowNull: false, validate: { is: TIME } },
  label: DataTypes.STRING(60),
}, { tableName: 'timetable_slots' });

const EVENT_CATEGORIES = ['holiday', 'exam', 'meeting', 'activity', 'other'];

const SchoolEvent = sequelize.define('SchoolEvent', {
  title: { type: DataTypes.STRING(150), allowNull: false },
  description: DataTypes.TEXT,
  category: { type: DataTypes.ENUM(...EVENT_CATEGORIES), allowNull: false, defaultValue: 'other' },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  audience: { type: DataTypes.ENUM('all', 'staff', 'parents'), allowNull: false, defaultValue: 'all' },
}, { tableName: 'events' });

// A private thread between one parent and one staff member, optionally about a pupil.
// Each side's last-read time is stored so unread messages can be counted.
const Conversation = sequelize.define('Conversation', {
  subject: { type: DataTypes.STRING(150), allowNull: false },
  lastMessageAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  parentLastReadAt: DataTypes.DATE,
  staffLastReadAt: DataTypes.DATE,
});

const Message = sequelize.define('Message', {
  body: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true, len: [1, 5000] } },
}, { updatedAt: false });

// Every email the system sends (or, in development, would have sent).
const EmailLog = sequelize.define('EmailLog', {
  event: { type: DataTypes.STRING(40), allowNull: false }, // results_published, fee_reminder, ...
  to: { type: DataTypes.STRING(120), allowNull: false },
  subject: { type: DataTypes.STRING(200), allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  html: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('sent', 'logged', 'failed'), allowNull: false },
  error: DataTypes.TEXT,
}, { tableName: 'email_log', updatedAt: false });

// Associations
AcademicSession.hasMany(Term, { onDelete: 'CASCADE' });
Term.belongsTo(AcademicSession);

SchoolClass.belongsTo(User, { as: 'classTeacher', foreignKey: 'classTeacherId' });
User.hasMany(SchoolClass, { as: 'homeClasses', foreignKey: 'classTeacherId' });

SchoolClass.hasMany(ClassSubject, { onDelete: 'CASCADE' });
ClassSubject.belongsTo(SchoolClass);
Subject.hasMany(ClassSubject, { onDelete: 'CASCADE' });
ClassSubject.belongsTo(Subject);
ClassSubject.belongsTo(User, { as: 'teacher', foreignKey: 'teacherId' });

SchoolClass.hasMany(Student);
Student.belongsTo(SchoolClass);

Student.belongsToMany(User, { through: StudentParent, as: 'parents', foreignKey: 'StudentId', otherKey: 'parentId' });
User.belongsToMany(Student, { through: StudentParent, as: 'children', foreignKey: 'parentId', otherKey: 'StudentId' });

for (const Model of [Attendance, Score, Observation, ReportRemark, Payment]) {
  Student.hasMany(Model, { onDelete: 'CASCADE' });
  Model.belongsTo(Student);
}
Attendance.belongsTo(User, { as: 'recordedBy', foreignKey: 'recordedById' });
Payment.belongsTo(User, { as: 'recordedBy', foreignKey: 'recordedById' });

Subject.hasMany(Score);
Score.belongsTo(Subject);

for (const Model of [Score, Observation, ReportRemark, FeeItem, Payment]) {
  Term.hasMany(Model);
  Model.belongsTo(Term);
}

SchoolClass.hasMany(FeeItem, { onDelete: 'CASCADE' });
FeeItem.belongsTo(SchoolClass);

Announcement.belongsTo(User, { as: 'postedBy', foreignKey: 'postedById' });
AuditLog.belongsTo(User);
EmailLog.belongsTo(User);

SchoolClass.hasMany(TimetableSlot, { onDelete: 'CASCADE' });
TimetableSlot.belongsTo(SchoolClass);
Subject.hasMany(TimetableSlot);
TimetableSlot.belongsTo(Subject);

SchoolEvent.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

Conversation.belongsTo(User, { as: 'parent', foreignKey: 'parentId' });
Conversation.belongsTo(User, { as: 'staff', foreignKey: 'staffId' });
Conversation.belongsTo(Student);
Conversation.hasMany(Message, { onDelete: 'CASCADE' });
Message.belongsTo(Conversation);
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });

module.exports = {
  sequelize,
  ROLES,
  MONTESSORI_AREAS,
  User,
  AcademicSession,
  Term,
  SchoolClass,
  Subject,
  ClassSubject,
  Student,
  StudentParent,
  Attendance,
  Score,
  Observation,
  ReportRemark,
  FeeItem,
  Payment,
  Announcement,
  AuditLog,
  EmailLog,
  TimetableSlot,
  SchoolEvent,
  EVENT_CATEGORIES,
  Conversation,
  Message,
};
