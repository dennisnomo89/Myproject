const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config');
const { User } = require('../models');
const { HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');

const MIN_PASSWORD_LENGTH = 8;

const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

const publicUser = (user) => {
  const { passwordHash, ...rest } = user.toJSON();
  return rest;
};

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
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const user = await User.scope('withPassword').findByPk(req.user.id);
  if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  await user.update({ passwordHash: await bcrypt.hash(newPassword, 10) });
  await audit(req, 'change_password', {});
  res.json({ message: 'Password changed' });
};

exports.MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;
