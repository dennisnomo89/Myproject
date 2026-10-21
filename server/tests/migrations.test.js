// Checks that the migrations build exactly the schema the models expect,
// so a model change without a matching migration fails CI.
const fs = require('fs');
const { sequelize } = require('../src/models');
const { createMigrator, MIGRATIONS_DIR } = require('../src/db/migrator');

const qi = sequelize.getQueryInterface();
const migrator = () => createMigrator({ quiet: true });

async function resetDatabase() {
  await qi.dropAllTables();
}

afterAll(() => sequelize.close());

describe('migrations', () => {
  beforeEach(resetDatabase);

  test('file names are timestamped and in order', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f) => expect(f).toMatch(/^\d{14}-[a-z0-9-]+\.js$/));
    expect([...files].sort()).toEqual(files);
  });

  test('every model matches its table after migrating an empty database', async () => {
    await migrator().up();
    const problems = [];
    for (const model of Object.values(sequelize.models)) {
      const table = model.getTableName();
      let columns;
      try {
        columns = await qi.describeTable(table);
      } catch {
        problems.push(`missing table ${table}`);
        continue;
      }
      for (const [name, attr] of Object.entries(model.rawAttributes)) {
        const field = attr.field || name;
        const col = columns[field];
        if (!col) {
          problems.push(`${table}.${field} is in the model but not in the migrations`);
          continue;
        }
        // SQLite reports INTEGER PRIMARY KEY columns as nullable even though they can't be; the primary key check covers them.
        if (!attr.primaryKey && (attr.allowNull === false) !== !col.allowNull) problems.push(`${table}.${field} allowNull differs`);
        if (Boolean(attr.primaryKey) !== Boolean(col.primaryKey)) problems.push(`${table}.${field} primary key differs`);
      }
      for (const field of Object.keys(columns)) {
        const known = Object.values(model.rawAttributes).some((a) => (a.field || a.fieldName) === field);
        if (!known) problems.push(`${table}.${field} is in the migrations but not in the model`);
      }
    }
    // If this fails: add a migration (npm run migrate:create <name>) for your model change.
    expect(problems).toEqual([]);
  });

  test('unique indexes from the models exist', async () => {
    await migrator().up();
    for (const model of Object.values(sequelize.models)) {
      for (const idx of (model.options.indexes || []).filter((i) => i.unique)) {
        const indexes = await qi.showIndex(model.getTableName());
        const found = indexes.some((i) => i.unique && JSON.stringify(i.fields.map((f) => f.attribute)) === JSON.stringify(idx.fields));
        expect({ table: model.getTableName(), fields: idx.fields, found }).toEqual({ table: model.getTableName(), fields: idx.fields, found: true });
      }
    }
  });

  test('an existing database made with sync() is adopted without losing data', async () => {
    await sequelize.sync();
    const { User } = sequelize.models;
    await User.create({ fullName: 'Existing Admin', email: 'existing@gvma.test', passwordHash: 'x', role: 'admin' });

    const applied = await migrator().up();
    expect(applied.map((m) => m.name)).toContain('20261021000000-initial-schema.js');
    expect(await User.count()).toBe(1);
    expect((await migrator().pending())).toHaveLength(0);
  });

  test('running migrate again does nothing', async () => {
    await migrator().up();
    expect(await migrator().up()).toEqual([]);
  });

  test('undo then redo rebuilds the schema', async () => {
    await migrator().up();
    await migrator().down({ to: 0 });
    const left = (await qi.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName)).filter((t) => t !== 'SequelizeMeta');
    expect(left).toEqual([]);
    await migrator().up();
    expect(await sequelize.models.Student.count()).toBe(0);
  });
});
