const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof UniqueConstraintError) {
    const field = err.errors[0] ? err.errors[0].path : 'value';
    return res.status(409).json({ message: `A record with this ${field} already exists` });
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({ message: err.errors.map((e) => e.message).join('; ') });
  }
  if (err instanceof ForeignKeyConstraintError) {
    return res.status(400).json({ message: 'Referenced record does not exist or is still in use' });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
}

module.exports = errorHandler;
