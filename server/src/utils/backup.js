// Full-database backup and restore as gzipped JSON.
// JSON (rather than a raw database file) works the same for SQLite and MySQL,
// so a backup taken in development can be restored on the production server and vice versa.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { backup: config } = require('../config');
const { sequelize } = require('../models');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const FORMAT = 'gvma-sms-backup';
const VERSION = 1;
const KINDS = ['manual', 'auto', 'pre-restore'];
// e.g. gvma-backup-2026-10-21T08-30-00-000Z-manual.json.gz
const NAME_PATTERN = /^gvma-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(manual|auto|pre-restore)\.json\.gz$/;

const models = () => Object.values(sequelize.models);

function ensureDir() {
  fs.mkdirSync(config.dir, { recursive: true });
}

// Resolves a backup name to its path, refusing anything that isn't a backup file name (no path tricks).
function backupPath(name) {
  if (!NAME_PATTERN.test(name || '')) {
    const err = new Error('Invalid backup name');
    err.status = 400;
    throw err;
  }
  return path.join(config.dir, name);
}

async function snapshot() {
  const tables = {};
  for (const model of models()) {
    // unscoped() so hidden columns such as password hashes are included and can be restored.
    tables[model.name] = await model.unscoped().findAll({ raw: true });
  }
  return {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    dialect: sequelize.getDialect(),
    tables,
  };
}

const summarize = (data) => Object.fromEntries(Object.entries(data.tables).map(([name, rows]) => [name, rows.length]));

async function createBackup(kind = 'manual') {
  if (!KINDS.includes(kind)) throw new Error(`Unknown backup kind ${kind}`);
  ensureDir();
  const data = await snapshot();
  const name = `gvma-backup-${data.createdAt.replace(/[:.]/g, '-')}-${kind}.json.gz`;
  await fs.promises.writeFile(path.join(config.dir, name), await gzip(JSON.stringify(data)));
  if (kind === 'auto') await pruneAutoBackups();
  return { ...(await describe(name)), tables: summarize(data) };
}

async function describe(name) {
  const stat = await fs.promises.stat(backupPath(name));
  return { name, kind: name.match(NAME_PATTERN)[1], size: stat.size, createdAt: stat.mtime.toISOString() };
}

async function listBackups() {
  ensureDir();
  const names = (await fs.promises.readdir(config.dir)).filter((n) => NAME_PATTERN.test(n));
  const items = await Promise.all(names.map(describe));
  return items.sort((a, b) => b.name.localeCompare(a.name)); // newest first (names start with the timestamp)
}

async function readBackup(name) {
  const data = JSON.parse((await gunzip(await fs.promises.readFile(backupPath(name)))).toString('utf8'));
  if (data.format !== FORMAT || data.version !== VERSION || !data.tables) {
    const err = new Error('This file is not a valid backup');
    err.status = 400;
    throw err;
  }
  return data;
}

async function setForeignKeyChecks(on, transaction) {
  const dialect = sequelize.getDialect();
  if (dialect === 'sqlite') await sequelize.query(`PRAGMA foreign_keys = ${on ? 'ON' : 'OFF'}`, { transaction });
  else if (dialect === 'mysql' || dialect === 'mariadb') await sequelize.query(`SET FOREIGN_KEY_CHECKS = ${on ? 1 : 0}`, { transaction });
}

// Replaces every table's contents with the backup's. A safety backup of the current data is taken first.
async function restoreBackup(name) {
  const data = await readBackup(name);
  const safety = await createBackup('pre-restore');

  // SQLite ignores PRAGMA foreign_keys inside a transaction, so switch it off around the transaction.
  await setForeignKeyChecks(false);
  try {
    await sequelize.transaction(async (transaction) => {
      if (sequelize.getDialect() !== 'sqlite') await setForeignKeyChecks(false, transaction);
      for (const model of models()) {
        await model.unscoped().destroy({ where: {}, truncate: false, force: true, transaction });
      }
      for (const model of models()) {
        const rows = data.tables[model.name] || [];
        // silent keeps the original createdAt/updatedAt; validate:false because rows were valid when saved.
        for (let i = 0; i < rows.length; i += 500) {
          await model.bulkCreate(rows.slice(i, i + 500), { transaction, validate: false, hooks: false, silent: true });
        }
      }
      if (sequelize.getDialect() !== 'sqlite') await setForeignKeyChecks(true, transaction);
    });
  } finally {
    await setForeignKeyChecks(true);
  }
  return { restored: name, backupCreatedAt: data.createdAt, safetyBackup: safety.name, tables: summarize(data) };
}

async function deleteBackup(name) {
  await fs.promises.unlink(backupPath(name));
}

// Keeps only the newest `keep` automatic backups. Manual and pre-restore backups are never removed automatically.
async function pruneAutoBackups() {
  const autos = (await listBackups()).filter((b) => b.kind === 'auto');
  for (const old of autos.slice(config.keep)) await deleteBackup(old.name);
}

// Runs an automatic backup when the newest one is older than the interval. Checks every hour.
function startSchedule() {
  const intervalMs = config.intervalHours * 3600e3;
  const check = async () => {
    try {
      const latest = (await listBackups()).find((b) => b.kind === 'auto');
      if (!latest || Date.now() - new Date(latest.createdAt).getTime() >= intervalMs) {
        const b = await createBackup('auto');
        console.log(`Automatic backup saved: ${b.name}`);
      }
    } catch (err) {
      console.error('Automatic backup failed:', err.message);
    }
  };
  check();
  const timer = setInterval(check, Math.min(intervalMs, 3600e3));
  timer.unref();
  return timer;
}

module.exports = {
  createBackup, listBackups, readBackup, restoreBackup, deleteBackup, backupPath, startSchedule, describe, NAME_PATTERN,
};
