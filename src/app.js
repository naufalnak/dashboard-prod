require('./config/env');

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const ipAllowlist = require('./lib/ipAllowlist');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(ipAllowlist);
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json());

app.use('/api', require('./routes/api'));

// Serve the built React frontend (web/dist)
const webDist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.use((req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

app.use(errorHandler());

module.exports = app;
