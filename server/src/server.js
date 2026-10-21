const app = require('./app');
const config = require('./config');
require('./models');
const { migrate } = require('./db/migrator');
const { checkProductionConfig } = require('./config/checkProduction');
const { startSchedule: startBackupSchedule } = require('./utils/backup');

async function start() {
  if (config.env === 'production') {
    const { problems, warnings } = checkProductionConfig(config);
    warnings.forEach((w) => console.warn(`Warning: ${w}`));
    if (problems.length) {
      problems.forEach((p) => console.error(`Cannot start: ${p}`));
      process.exit(1);
    }
  }

  // Brings the database schema up to date. Existing data is kept; only new migrations run.
  const applied = await migrate({ quiet: true });
  if (applied.length) console.log(`Applied database migrations: ${applied.join(', ')}`);
  app.listen(config.port, () => {
    console.log(`GVMA SMS running on http://localhost:${config.port} (${config.env})`);
  });
  startBackupSchedule();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
