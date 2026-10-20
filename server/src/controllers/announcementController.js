const { Op } = require('sequelize');
const { Announcement, User } = require('../models');
const { HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');
const notifications = require('../utils/notifications');

const AUDIENCES = ['all', 'staff', 'parents'];

const visibleAudiences = (role) => (role === 'parent' ? ['all', 'parents'] : role === 'admin' ? AUDIENCES : ['all', 'staff']);

exports.list = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json(await Announcement.findAll({
    where: { audience: { [Op.in]: visibleAudiences(req.user.role) } },
    include: [{ model: User, as: 'postedBy', attributes: ['id', 'fullName', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit,
  }));
};

exports.create = async (req, res) => {
  const { title, body, audience = 'all' } = req.body;
  if (!AUDIENCES.includes(audience)) throw new HttpError(400, `Audience must be one of: ${AUDIENCES.join(', ')}`);
  // Teachers may post to parents and staff, but school-wide notices come from the admin.
  if (req.user.role === 'teacher' && audience === 'all') throw new HttpError(403, 'Only administrators can post to everyone');
  const a = await Announcement.create({ title, body, audience, postedById: req.user.id });
  await audit(req, 'post_announcement', { id: a.id, audience });
  if (req.body.sendEmail !== false) notifications.announcement(a);
  res.status(201).json(a);
};

exports.remove = async (req, res) => {
  const a = await Announcement.findByPk(req.params.id);
  if (!a) throw new HttpError(404, 'Announcement not found');
  if (req.user.role !== 'admin' && a.postedById !== req.user.id) throw new HttpError(403, 'You can only delete your own announcements');
  await a.destroy();
  res.status(204).end();
};
