require('../src/config/env');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const apiRouter = require('../src/routes/api');
const ipAllowlist = require('../src/lib/ipAllowlist');
const errorHandler = require('../src/middlewares/errorHandler');

const app = express();

app.set('trust proxy', true);
app.use(ipAllowlist);
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRouter);

app.use(errorHandler({ exposeMessage: true }));

module.exports = app;
