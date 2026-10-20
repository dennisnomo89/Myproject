const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, ROLES } = require('../models');
const { HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');
const { MIN_PASSWORD_LENGTH } = require('./authController');

exports.list = async (req, res) => {
  const { role, q } = req.query;
  const where = {};
  if (role) where.role = role;
  if (q) where[Op.or] = [{ fullName: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
  res.json(await User.findAll({ where, order: [['fullName', 'ASC']] }));
};

exports.create = async (req, res) => {
  const { fullName, email, password, role, phone } = req.body;
  if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(', ')}`);
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const user = await User.create({
    fullName,
    email: (email || '').trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    role,
    phone,
  });
  await audit(req, 'create_user', { id: user.id, email: user.email, role });
  res.status(201).json(await User.findByPk(user.id));
};

exports.update = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const { fullName, phone, role, isActive, password } = req.body;
  if (role && !ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
  if (user.id === req.user.id && (isActive === false || (role && role !== 'admin'))) {
    throw new HttpError(400, 'You cannot deactivate or demote your own account');
  }
  const changes = { fullName, phone, role, isActive };
  Object.keys(changes).forEach((k) => changes[k] === undefined && delete changes[k]);
  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, 'Password is too short');
    changes.passwordHash = await bcrypt.hash(password, 10);
  }
  await user.update(changes);
  await audit(req, 'update_user', { id: user.id, fields: Object.keys(changes) });
  res.json(await User.findByPk(user.id));
};
