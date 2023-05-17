"use strict"

const express = require('express');
const router = express.Router();

const logger = require('../src/log');

router.all('*', function(req, res, next) {
  logger.store(req.socket.remoteAddress, req.originalUrl, req.body)
    .then(() => next())
    .catch(next);
});

module.exports = router;
