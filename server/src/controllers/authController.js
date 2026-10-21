const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { jwtSecret, jwtExpiresIn } = require('../config');
const { User, PasswordReset } = require('../models');
const { HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');
const { sendEmail } = require('../utils/mailer');
const templates = require('../utils/emailTemplates');

const MIN_PASSWORD_LENGTH = 8;
const RESET_TTL_MINUTES = 60;
const RESET_REQUESTS_PER_HOUR = 3;

const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

const publicUser = (user) => {
  const { passwordHash, ...rest } = user.toJSON();
  return rest;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function assertPasswordStrength(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

// Sets a new password and logs out every existing session for the user.
async function setPassword(user, password) {
  await user.update({ passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date() });
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.scope('withPassword').findOne({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');

  req.user = user;
  await audit(req, 'login', { email: user.email });
  res.json({ token: signToken(user), user: publicUser(user) });
};

// Issues a fresh token. The web app calls this while the user is active,
// so a session only expires after a period of inactivity.
exports.refresh = async (req, res) => {
  res.json({ token: signToken(req.user) });
};

exports.me = async (req, res) => {
  res.json(req.user);
};

exports.updateProfile = async (req, res) => {
  const { fullName, phone, emailNotifications } = req.body;
  await req.user.update({
    ...(fullName && { fullName }),
    ...(phone !== undefined && { phone }),
    ...(emailNotifications !== undefined && { emailNotifications: Boolean(emailNotifications) }),
  });
  res.json(req.user);
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  assertPasswordStrength(newPassword);
  const user = await User.scope('withPassword').findByPk(req.user.id);
  if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  await setPassword(user, newPassword);
  await audit(req, 'change_password', {});
  // Other devices are logged out; this one gets a new token so it stays signed in.
  res.json({ message: 'Password changed. Any other devices have been signed out.', token: signToken(user) });
};

const FORGOT_RESPONSE = { message: 'If an account exists for that email, a password reset link has been sent. The link expires in 1 hour.' };

// Body: { email }. Always gives the same answer, so it can't be used to discover which emails have accounts.
exports.forgotPassword = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) throw new HttpError(400, 'Email is required');
  const user = await User.findOne({ where: { email, isActive: true } });
  if (!user) return res.json(FORGOT_RESPONSE);

  const recent = await PasswordReset.count({ where: { UserId: user.id, createdAt: { [Op.gt]: new Date(Date.now() - 3600e3) } } });
  if (recent >= RESET_REQUESTS_PER_HOUR) return res.json(FORGOT_RESPONSE);

  const token = crypto.randomBytes(32).toString('hex');
  await PasswordReset.create({
    UserId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60e3),
  });
  // Sent even if the user turned off notification emails: they asked for this one.
  await sendEmail({ to: user.email, user, event: 'password_reset', ...templates.passwordReset({ user, token, minutes: RESET_TTL_MINUTES }) });
  req.user = user;
  await audit(req, 'request_password_reset', { email });
  res.json(FORGOT_RESPONSE);
};

// Body: { token, password }
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  assertPasswordStrength(password);
  const reset = token && await PasswordReset.findOne({ where: { tokenHash: hashToken(String(token)) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  }
  const user = await User.scope('withPassword').findByPk(reset.UserId);
  if (!user || !user.isActive) throw new HttpError(400, 'This account is not active');

  await setPassword(user, password);
  // Use up this link and any other outstanding ones.
  await PasswordReset.update({ usedAt: new Date() }, { where: { UserId: user.id, usedAt: null } });
  req.user = user;
  await audit(req, 'reset_password', { email: user.email });
  res.json({ message: 'Your password has been reset. You can now sign in.' });
};

exports.MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;
exports.setPassword = setPassword;
