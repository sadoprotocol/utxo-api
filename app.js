const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors')

const indexRouter = require('./routes/index');
const utxoRouter = require('./routes/utxo');

const app = express();

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({limit: '100mb', extended: true}))
app.use(express.urlencoded({limit: '100mb', extended: true}))

app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/utxo', utxoRouter);

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
