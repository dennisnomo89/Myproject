const path = require('path');

// Paths in .env are relative to the server folder, wherever the process is started from.
const SERVER_ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Base URL used for links inside emails.
  appUrl: process.env.APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  backup: {
    // Where backup files are kept, how often the automatic backup runs, and how many automatic ones to keep.
    dir: env === 'test'
      ? path.join(require('os').tmpdir(), `gvma-test-backups-${process.pid}`)
      : path.resolve(SERVER_ROOT, process.env.BACKUP_DIR || './backups'),
    intervalHours: Number(process.env.BACKUP_INTERVAL_HOURS) || 24,
    keep: Number(process.env.BACKUP_KEEP) || 14,
  },
  mail: {
    // Without SMTP_HOST, emails are only recorded in the email log (development mode).
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Global Virgins Montessori Academy <no-reply@gvma.test>',
  },
  db: {
    // SQLite for local development and tests; MySQL for production.
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: env === 'test' ? ':memory:' : path.resolve(SERVER_ROOT, process.env.DB_STORAGE || './data/dev.sqlite'),
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'school_management',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
};
