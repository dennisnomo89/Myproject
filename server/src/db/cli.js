// Command line for migrations:
//   npm run migrate              apply all pending migrations
//   npm run migrate:status       list applied and pending migrations
//   npm run migrate:undo         undo the most recent migration
//   npm run migrate:create name  create a new, empty migration file
const fs = require('fs');
const path = require('path');
const { createMigrator, MIGRATIONS_DIR } = require('./migrator');
const sequelize = require('../config/database');

const TEMPLATE = `// Describe what this migration changes and why.
module.exports = {
  async up({ queryInterface, Sequelize }) {
    // e.g. await queryInterface.addColumn('Students', 'bloodGroup', { type: Sequelize.STRING(5) });
  },

  async down({ queryInterface }) {
    // Undo exactly what up() did, e.g. await queryInterface.removeColumn('Students', 'bloodGroup');
  },
};
`;

async function main() {
  const [command = 'up', name] = process.argv.slice(2);
  const migrator = createMigrator();

  if (command === 'create') {
    if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Give the migration a short name in lowercase-with-dashes, e.g. add-blood-group');
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const file = path.join(MIGRATIONS_DIR, `${stamp}-${name}.js`);
    fs.writeFileSync(file, TEMPLATE);
    console.log(`Created ${path.relative(process.cwd(), file)}`);
    console.log('Remember to change the model in src/models/index.js to match.');
  } else if (command === 'status') {
    const [done, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
    console.log('Applied:');
    done.forEach((m) => console.log(`  ✓ ${m.name}`));
    console.log(pending.length ? 'Pending:' : 'Nothing pending — the database is up to date.');
    pending.forEach((m) => console.log(`  • ${m.name}`));
  } else if (command === 'down') {
    const undone = await migrator.down();
    console.log(undone.length ? `Undid ${undone[0].name}` : 'No migrations to undo.');
  } else if (command === 'up') {
    const applied = await migrator.up();
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : 'The database is already up to date.');
  } else {
    throw new Error(`Unknown command "${command}". Use up, status, down or create.`);
  }
}

main()
  .then(() => sequelize.close())
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
