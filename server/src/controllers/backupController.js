const backup = require('../utils/backup');
const { backup: config } = require('../config');
const { HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');

const RESTORE_CONFIRMATION = 'RESTORE';

exports.list = async (req, res) => {
  res.json({
    schedule: { intervalHours: config.intervalHours, keep: config.keep },
    backups: await backup.listBackups(),
  });
};

exports.create = async (req, res) => {
  const result = await backup.createBackup('manual');
  await audit(req, 'create_backup', { name: result.name });
  res.status(201).json(result);
};

exports.download = async (req, res) => {
  const file = backup.backupPath(req.params.name);
  await audit(req, 'download_backup', { name: req.params.name });
  res.download(file, req.params.name, (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'Backup not found' });
  });
};

// Body: { confirm: "RESTORE" }
exports.restore = async (req, res) => {
  if (req.body.confirm !== RESTORE_CONFIRMATION) {
    throw new HttpError(400, `Type ${RESTORE_CONFIRMATION} to confirm. Restoring replaces all current data.`);
  }
  backup.backupPath(req.params.name); // validates the name before doing anything
  const result = await backup.restoreBackup(req.params.name);
  // Logged after the restore so the entry is not wiped by it.
  await audit(req, 'restore_backup', { name: req.params.name, safetyBackup: result.safetyBackup });
  res.json(result);
};

exports.remove = async (req, res) => {
  await backup.deleteBackup(req.params.name);
  await audit(req, 'delete_backup', { name: req.params.name });
  res.status(204).end();
};
