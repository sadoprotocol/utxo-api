"use strict";

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const helmet = require('helmet');
const publicIp = require('public-ip');

const allRouter = require('./routes/all');
const indexRouter = require('./routes/index');
const utxoRouter = require('./routes/utxo');
const sadoRouter = require('./routes/sado');

const ipTrack = process.env.IPTRACK;

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({limit: '100mb', extended: true}))
app.use(express.urlencoded({limit: '100mb', extended: true}))

app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', "*");
  res.header("Access-Control-Allow-Headers", "*");
  if ('OPTIONS' === req.method) {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(function (req, res, next) {
  (async () => {
    let v4 = false;
    let v6 = false;

    if (ipTrack.toLowerCase() === 'v6') {
      v6 = await publicIp.v6();
    } else {
      v4 = await publicIp.v4();
    }

    req.clientIp = v4 || v6 || '';
    next();
  })();
});

app.use('*', allRouter);
app.use('/', indexRouter);
app.use('/utxo', utxoRouter);
app.use('/sado', sadoRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // render the error page
  res.status(err.status || 500);

  res.json({
    success: false,
    message: err.message || err
  });
});

module.exports = app;
