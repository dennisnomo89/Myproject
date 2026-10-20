const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler: h } = require('../utils/httpError');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const academic = require('../controllers/academicController');
const students = require('../controllers/studentController');
const attendance = require('../controllers/attendanceController');
const results = require('../controllers/resultController');
const fees = require('../controllers/feeController');
const announcements = require('../controllers/announcementController');
const dashboard = require('../controllers/dashboardController');

const router = express.Router();
const admin = authorize('admin');
const staff = authorize('admin', 'teacher');
const finance = authorize('admin', 'bursar');

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Authentication
router.post('/auth/login', h(auth.login));
router.use(authenticate);
router.get('/auth/me', h(auth.me));
router.patch('/auth/me', h(auth.updateProfile));
router.post('/auth/change-password', h(auth.changePassword));

// Dashboard and audit log
router.get('/dashboard', h(dashboard.summary));
router.get('/audit-log', admin, h(dashboard.auditLog));
router.get('/email-log', admin, h(dashboard.emailLog));

// User accounts (admin only)
router.get('/users', authorize('admin', 'bursar'), h(users.list));
router.post('/users', admin, h(users.create));
router.patch('/users/:id', admin, h(users.update));

// Sessions and terms
router.get('/sessions', h(academic.listSessions));
router.post('/sessions', admin, h(academic.createSession));
router.get('/terms/current', h(academic.currentTerm));
router.patch('/terms/:id', admin, h(academic.updateTerm));
router.post('/terms/:id/set-current', admin, h(academic.setCurrentTerm));

// Classes and subjects
router.get('/classes', authorize('admin', 'teacher', 'bursar'), h(academic.listClasses));
router.post('/classes', admin, h(academic.createClass));
router.patch('/classes/:id', admin, h(academic.updateClass));
router.delete('/classes/:id', admin, h(academic.deleteClass));
router.post('/classes/:id/subjects', admin, h(academic.assignSubject));
router.delete('/classes/:id/subjects/:subjectId', admin, h(academic.removeSubject));
router.get('/subjects', h(academic.listSubjects));
router.post('/subjects', admin, h(academic.createSubject));
router.delete('/subjects/:id', admin, h(academic.deleteSubject));

// Students (list/get are scoped to what each role may see)
router.get('/students', h(students.list));
router.get('/students/:id', h(students.get));
router.post('/students', admin, h(students.create));
router.patch('/students/:id', admin, h(students.update));
router.post('/students/:id/parents', admin, h(students.linkParent));
router.delete('/students/:id/parents/:parentId', admin, h(students.unlinkParent));

// Attendance
router.get('/attendance', staff, h(attendance.classRegister));
router.post('/attendance', staff, h(attendance.saveRegister));
router.get('/attendance/student/:studentId', h(attendance.studentSummary));

// Results
router.get('/scores', staff, h(results.scoreSheet));
router.post('/scores', staff, h(results.saveScores));
router.get('/results/broadsheet', staff, h(results.broadsheet));
router.get('/results/report/:studentId', h(results.reportCard));
router.post('/results/observations/:studentId', staff, h(results.saveObservations));
router.post('/results/remarks/:studentId', staff, h(results.saveRemark));

// Fees
router.get('/fees/items', finance, h(fees.listItems));
router.post('/fees/items', finance, h(fees.createItem));
router.delete('/fees/items/:id', finance, h(fees.deleteItem));
router.get('/fees/statement/:studentId', authorize('admin', 'bursar', 'parent'), h(fees.statement));
router.post('/fees/payments', finance, h(fees.recordPayment));
router.get('/fees/payments/:id/receipt', authorize('admin', 'bursar', 'parent'), h(fees.receipt));
router.get('/fees/reports/collection', finance, h(fees.collectionReport));
router.get('/fees/reports/debtors', finance, h(fees.debtors));
router.post('/fees/reminders', finance, h(fees.sendReminders));

// Announcements
router.get('/announcements', h(announcements.list));
router.post('/announcements', staff, h(announcements.create));
router.delete('/announcements/:id', staff, h(announcements.remove));

module.exports = router;
