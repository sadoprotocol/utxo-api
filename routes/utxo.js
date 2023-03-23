const express = require('express');
const router = express.Router();
const createError = require('http-errors');

const utxo = require('../src/utxo');

router.all('*', function(req, res, next) {
  if (req.body && req.body.address) {
    next();
  } else {
    next(createError(416, "Expecting address key value"));
  }
});

router.all('/balance', function(req, res, next) {
  utxo.balance(req.body.address).then(balance => {
    res.json({
      success: true,
      message: 'Balance of ' + req.body.address,
      rdata: balance
    });
  }).catch(next);
});

router.all('/transactions', function(req, res, next) {
  utxo.transactions(req.body.address).then(balance => {
    res.json({
      success: true,
      message: 'Transactions of ' + req.body.address,
      rdata: balance
    });
  }).catch(next);
});

router.all('/unspents', function(req, res, next) {
  utxo.unspents(req.body.address).then(balance => {
    res.json({
      success: true,
      message: 'Unspents of ' + req.body.address,
      rdata: balance
    });
  }).catch(next);
});


module.exports = router;
