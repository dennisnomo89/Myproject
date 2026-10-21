// Settings checks for running at the school. Problems stop the server; warnings are printed.
const WEAK_SECRETS = ['change-me', 'secret', 'password', 'changeme'];
const MIN_SECRET_LENGTH = 32;

function checkProductionConfig(config) {
  const problems = [];
  const warnings = [];

  const secret = config.jwtSecret || '';
  if (!secret || secret === config.DEV_JWT_SECRET || WEAK_SECRETS.includes(secret.toLowerCase())) {
    problems.push('JWT_SECRET is not set. Set it to a long random string (see the deployment guide in the README).');
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET is too short (${secret.length} characters). Use at least ${MIN_SECRET_LENGTH}.`);
  }

  if (!config.appUrl || /localhost|127\.0\.0\.1/.test(config.appUrl)) {
    warnings.push('APP_URL points at localhost, so links in emails (reset links, report cards) will not work for parents. Set it to the school portal address.');
  } else if (!config.appUrl.startsWith('https://')) {
    warnings.push('APP_URL does not use https://. Serve the portal over HTTPS so passwords are encrypted in transit (SRS 4.2).');
  }
  if (!config.mail.host) {
    warnings.push('SMTP_HOST is not set, so emails are only recorded in the Email Log and never sent.');
  }
  if (config.db.dialect === 'sqlite') {
    warnings.push('Using SQLite. That is fine for one small school on one server; use MySQL if several servers share the database.');
  }
  return { problems, warnings };
}

module.exports = { checkProductionConfig, MIN_SECRET_LENGTH };
