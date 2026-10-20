const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { startSchedule: startBackupSchedule } = require('./utils/backup');

async function start() {
  // Creates missing tables. Use migrations instead of sync once the schema settles.
  await sequelize.sync();
  app.listen(config.port, () => {
    console.log(`GVMA SMS API running on http://localhost:${config.port}/api`);
  });
  startBackupSchedule();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
