const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Behind a reverse proxy (Nginx, a hosting platform), this makes req.ip the real client address.
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
if (config.env === 'development') app.use(morgan('dev'));

app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));

// In production the API also serves the built web app, so the school runs a single server.
// Any non-API page (e.g. /students/3) gets index.html and the web app's router takes over.
const indexHtml = path.join(config.clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(config.clientDist, {
    index: false,
    // Built files have content hashes in their names, so they can be cached for a long time.
    setHeaders: (res, file) => {
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use(errorHandler);

module.exports = app;
