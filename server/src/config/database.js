const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { db } = require('./index');

let sequelize;

if (db.dialect === 'sqlite') {
  if (db.storage !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(db.storage)), { recursive: true });
  }
  sequelize = new Sequelize({ dialect: 'sqlite', storage: db.storage, logging: false });
} else {
  sequelize = new Sequelize(db.database, db.username, db.password, {
    host: db.host,
    port: db.port,
    dialect: db.dialect,
    logging: false,
  });
}

module.exports = sequelize;
