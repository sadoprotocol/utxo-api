const express = require('express');
const router = express.Router();
const createError = require('http-errors');

const utxo = require('../src/utxo');



// txid base ==

router.all(['/transaction'], function(req, res, next) {
  if (req.body && req.body.txid) {
    next();
  } else {
    next(createError(416, "Expecting txid key value"));
  }
});

router.all('/transaction', function(req, res, next) {
  utxo.transaction(req.body.txid).then(transaction => {
    res.json({
      success: true,
      message: 'Transaction of ' + req.body.txid,
      rdata: transaction
    });
  }).catch(next);
});


// address base ==

router.all(['/balance', '/transactions', '/unspents'], function(req, res, next) {
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
  utxo.transactions(req.body.address).then(transactions => {
    res.json({
      success: true,
      message: 'Transactions of ' + req.body.address,
      rdata: transactions
    });
  }).catch(next);
});

router.all('/unspents', function(req, res, next) {
  utxo.unspents(req.body.address).then(unspents => {
    res.json({
      success: true,
      message: 'Unspents of ' + req.body.address,
      rdata: unspents
    });
  }).catch(next);
});



module.exports = router;
