"use strict";

const express = require('express');
const router = express.Router();
const createError = require('http-errors');

const sado = require('../src/sado');



// address base ==

router.all(['/get'], function(req, res, next) {
  if (req.body && req.body.address) {
    next();
  } else {
    next(createError(416, "Expecting address key value"));
  }
});

router.all('/get', function(req, res, next) {
  sado.get(req.body.address).then(balance => {
    res.json({
      success: true,
      message: 'Orderbook of ' + req.body.address,
      rdata: balance
    });
  }).catch(next);
});



module.exports = router;
