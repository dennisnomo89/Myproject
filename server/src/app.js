const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
if (config.env === 'development') app.use(morgan('dev'));

app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));
app.use(errorHandler);

module.exports = app;
