// Initial schema: every table the system had before migrations were introduced.
// Generated once from the Sequelize models on 2026-10-21, then reviewed by hand.
//
// Databases created earlier with sequelize.sync() already have these tables. For those,
// up() does nothing and the migration is simply recorded as applied, so no data is touched.

const TABLES_IN_CREATION_ORDER = [
  'AcademicSessions',
  'Users',
  'Announcements',
  'AuditLogs',
  'classes',
  'Students',
  'Conversations',
  'Terms',
  'FeeItems',
  'Messages',
  'Observations',
  'Payments',
  'ReportRemarks',
  'Subjects',
  'Scores',
  'attendance',
  'class_subjects',
  'email_log',
  'events',
  'password_resets',
  'student_parents',
  'timetable_slots',
];

module.exports = {
  async up({ queryInterface, Sequelize }) {
    const existing = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (existing.includes('Users')) return; // adopted an existing database

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('AcademicSessions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        name: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        isCurrent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.createTable('Users', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        fullName: { type: Sequelize.STRING(120), allowNull: false },
        email: { type: Sequelize.STRING(120), allowNull: false, unique: true },
        passwordHash: { type: Sequelize.STRING, allowNull: false },
        role: { type: Sequelize.ENUM('admin', 'teacher', 'bursar', 'parent'), allowNull: false },
        phone: { type: Sequelize.STRING(20), allowNull: true },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        emailNotifications: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        passwordChangedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.createTable('Announcements', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        title: { type: Sequelize.STRING(150), allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: false },
        audience: { type: Sequelize.ENUM('all', 'staff', 'parents'), allowNull: false, defaultValue: 'all' },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        postedById: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('AuditLogs', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        action: { type: Sequelize.STRING(100), allowNull: false },
        details: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        UserId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('classes', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        name: { type: Sequelize.STRING(50), allowNull: false },
        arm: { type: Sequelize.STRING(10), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        classTeacherId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('Students', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        admissionNo: { type: Sequelize.STRING(30), allowNull: false, unique: true },
        firstName: { type: Sequelize.STRING(60), allowNull: false },
        lastName: { type: Sequelize.STRING(60), allowNull: false },
        gender: { type: Sequelize.ENUM('male', 'female'), allowNull: false },
        dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
        admissionDate: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.ENUM('active', 'graduated', 'withdrawn'), allowNull: false, defaultValue: 'active' },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        SchoolClassId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'classes', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('Conversations', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        subject: { type: Sequelize.STRING(150), allowNull: false },
        lastMessageAt: { type: Sequelize.DATE, allowNull: false },
        parentLastReadAt: { type: Sequelize.DATE, allowNull: true },
        staffLastReadAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        parentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        staffId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('Terms', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        name: { type: Sequelize.STRING(20), allowNull: false },
        startDate: { type: Sequelize.DATEONLY, allowNull: true },
        endDate: { type: Sequelize.DATEONLY, allowNull: true },
        isCurrent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        resultsPublished: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        AcademicSessionId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'AcademicSessions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('FeeItems', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        description: { type: Sequelize.STRING(100), allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        TermId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Terms', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        SchoolClassId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'classes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('Messages', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        ConversationId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Conversations', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        senderId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('Observations', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        area: { type: Sequelize.ENUM('practical_life', 'sensorial', 'language', 'mathematics', 'culture'), allowNull: false },
        rating: { type: Sequelize.ENUM('emerging', 'developing', 'secure'), allowNull: false },
        comment: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        TermId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Terms', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.addIndex('Observations', ['StudentId', 'TermId', 'area'], { unique: true, transaction });
      await queryInterface.createTable('Payments', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        method: { type: Sequelize.ENUM('cash', 'transfer', 'pos'), allowNull: false },
        receiptNo: { type: Sequelize.STRING(30), allowNull: false, unique: true },
        paidOn: { type: Sequelize.DATEONLY, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        recordedById: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        TermId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Terms', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('ReportRemarks', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        teacherRemark: { type: Sequelize.TEXT, allowNull: true },
        headRemark: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        TermId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Terms', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.addIndex('ReportRemarks', ['StudentId', 'TermId'], { unique: true, transaction });
      await queryInterface.createTable('Subjects', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.createTable('Scores', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        caScore: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        examScore: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        remark: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        SubjectId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Subjects', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        TermId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Terms', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.addIndex('Scores', ['StudentId', 'SubjectId', 'TermId'], { unique: true, transaction });
      await queryInterface.createTable('attendance', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        status: { type: Sequelize.ENUM('present', 'absent', 'late', 'excused'), allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        recordedById: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.addIndex('attendance', ['StudentId', 'date'], { unique: true, transaction });
      await queryInterface.createTable('class_subjects', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        SchoolClassId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'classes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        SubjectId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Subjects', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        teacherId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.addIndex('class_subjects', ['SchoolClassId', 'SubjectId'], { unique: true, transaction });
      await queryInterface.createTable('email_log', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        event: { type: Sequelize.STRING(40), allowNull: false },
        to: { type: Sequelize.STRING(120), allowNull: false },
        subject: { type: Sequelize.STRING(200), allowNull: false },
        text: { type: Sequelize.TEXT, allowNull: false },
        html: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM('sent', 'logged', 'failed'), allowNull: false },
        error: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        UserId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('events', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        title: { type: Sequelize.STRING(150), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        category: { type: Sequelize.ENUM('holiday', 'exam', 'meeting', 'activity', 'other'), allowNull: false, defaultValue: 'other' },
        startDate: { type: Sequelize.DATEONLY, allowNull: false },
        endDate: { type: Sequelize.DATEONLY, allowNull: false },
        audience: { type: Sequelize.ENUM('all', 'staff', 'parents'), allowNull: false, defaultValue: 'all' },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        createdById: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('password_resets', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        tokenHash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        expiresAt: { type: Sequelize.DATE, allowNull: false },
        usedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        UserId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('student_parents', {
        relationship: { type: Sequelize.STRING(30), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        StudentId: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'Students', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        parentId: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      }, { transaction });
      await queryInterface.createTable('timetable_slots', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        day: { type: Sequelize.INTEGER, allowNull: false },
        startTime: { type: Sequelize.STRING(5), allowNull: false },
        endTime: { type: Sequelize.STRING(5), allowNull: false },
        label: { type: Sequelize.STRING(60), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        SchoolClassId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'classes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        SubjectId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Subjects', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      }, { transaction });
    });
  },

  async down({ queryInterface }) {
    // Drop in reverse order so foreign keys are never left dangling.
    for (const table of [...TABLES_IN_CREATION_ORDER].reverse()) {
      await queryInterface.dropTable(table);
    }
  },
};
