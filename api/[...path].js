require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const apiRouter = require('../src/routes/index');
const ipAllowlist = require('../src/lib/ipAllowlist');
const errorHandler = require('../src/middlewares/errorHandler');

const app = express();

app.set('trust proxy', true);
app.use(ipAllowlist);
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRouter);

// HARUS didaftarkan paling terakhir -- lihat src/middlewares/errorHandler.js.
// Sebelumnya ada salinan inline hampir identik di sini, sekarang satu
// sumber dipakai di app.js (server biasa) dan di sini (Vercel serverless).
app.use(errorHandler);

module.exports = app;