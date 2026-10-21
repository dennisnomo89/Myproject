// Versioned database migrations (Umzug). Each file in server/migrations/ changes the schema one step,
// and the SequelizeMeta table records which ones have run, so existing data is kept.
const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

function createMigrator({ quiet = false } = {}) {
  return new Umzug({
    migrations: {
      glob: ['*.js', { cwd: MIGRATIONS_DIR }],
      // Each migration gets the query interface plus Sequelize (for DataTypes).
      resolve: ({ name, path: file, context }) => {
        const migration = require(file);
        return {
          name,
          up: () => migration.up({ queryInterface: context, Sequelize }),
          down: () => migration.down({ queryInterface: context, Sequelize }),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: quiet ? undefined : console,
  });
}

// Applies any migrations that haven't run yet. Returns the names that were applied.
async function migrate(options) {
  const applied = await createMigrator(options).up();
  return applied.map((m) => m.name);
}

module.exports = { createMigrator, migrate, MIGRATIONS_DIR };
