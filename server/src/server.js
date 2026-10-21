const app = require('./app');
const config = require('./config');
require('./models');
const { migrate } = require('./db/migrator');
const { startSchedule: startBackupSchedule } = require('./utils/backup');

async function start() {
  // Brings the database schema up to date. Existing data is kept; only new migrations run.
  const applied = await migrate({ quiet: true });
  if (applied.length) console.log(`Applied database migrations: ${applied.join(', ')}`);
  app.listen(config.port, () => {
    console.log(`GVMA SMS API running on http://localhost:${config.port}/api`);
  });
  startBackupSchedule();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
