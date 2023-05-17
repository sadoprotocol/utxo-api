"use strict"

const express = require('express');
const router = express.Router();

const logger = require('../src/log');

router.all('*', function(req, res, next) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  logger.store(ip, req.originalUrl, req.body)
    .then(() => next())
    .catch(next);
});

module.exports = router;
