"use strict";

const express = require('express');
const router = express.Router();
const createError = require('http-errors');

const utxo = require('../src/utxo');
const blockcypher = require('../src/blockcypher');
const sochain = require('../src/sochain');
const inscription = require('../src/inscription');
const cache = require('../src/cache');

const lookupMode = process.env.LOOKUPMODE;
const relayMode = process.env.RELAYMODE;

var lookup;

if (lookupMode === 'utxo') {
  lookup = utxo;
} else if (lookupMode === 'blockcypher') {
  lookup = blockcypher;
} else if (lookupMode === 'sochain') {
  lookup = sochain;
} else {
  throw new Error("Unknown lookup mode.");
}


// no params

router.all('/inscriptions/:outpoint/:id/media', function(req, res, next) {
  inscription.media.get(req.params.outpoint, req.params.id).then(data => {
    let buff = Buffer.from(data.media_content, 'base64');

    res.writeHead(200, {
      'Content-Type': data.media_type,
      'Content-Length': buff.length
    });
    res.end(buff);
  }).catch(next);
});

router.all('/inscriptions/:outpoint', function(req, res, next) {
  utxo.inscriptions(req.params.outpoint).then(data => {
    res.json({
      success: true,
      message: 'Inscriptions for outpoint ' + req.params.outpoint,
      rdata: data
    });
  }).catch(next);
});

router.all('/mempool_info', function(req, res, next) {
  utxo.mempool_info().then(data => {
    res.json({
      success: true,
      message: 'Information of the current mempool activity',
      rdata: data
    });
  }).catch(next);
});

router.all('/unconfirmed_transactions', function(req, res, next) {
  utxo.unconfirmed_transactions(req.body.options).then(transaction => {
    res.json({
      success: true,
      message: 'Unconfirmed Transactions',
      rdata: transaction
    });
  }).catch(next);
});


// hex base ==

router.all(['/relay'], function(req, res, next) {
  if (req.body && req.body.hex) {
    next();
  } else {
    next(createError(416, "Expecting hex key value"));
  }
});

router.all('/relay', function(req, res, next) {
  if (relayMode === 'blockcypher') {
    lookup = blockcypher;
  } else if (relayMode === 'sochain') {
    lookup = sochain;
  } else {
    lookup = utxo;
  }

  lookup.relay(req.body.hex).then(txid => {
    res.json({
      success: true,
      message: 'Relayed',
      rdata: txid
    });
  }).catch(next);
});


// txid base ==

router.all(['/transaction'], function(req, res, next) {
  if (req.body && req.body.txid) {
    next();
  } else {
    next(createError(416, "Expecting txid key value"));
  }
});

router.all('/transaction', function(req, res, next) {
  lookup.transaction(req.body.txid, req.body.options).then(transaction => {
    res.json({
      success: true,
      message: 'Transaction of ' + req.body.txid,
      rdata: transaction
    });
  }).catch(next);
});

router.all('/unconfirmed_transaction', function(req, res, next) {
  utxo.unconfirmed_transaction(req.body.txid).then(transaction => {
    res.json({
      success: true,
      message: 'Unconfirmed transaction of ' + req.body.txid,
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
  lookup.balance(req.body.address).then(balance => {
    res.json({
      success: true,
      message: 'Balance of ' + req.body.address,
      rdata: balance
    });
  }).catch(next);
});

router.all('/transactions', function(req, res, next) {
  cache.transactionsAll.fetch(req.body.address, req.body.options).then(result => {
    res.json({
      success: true,
      message: 'Transactions of ' + req.body.address,
      rdata: result.txs,
      options: result.options
    });
  }).catch(next);
});

router.all('/unspents', function(req, res, next) {
  lookup.unspents(req.body.address, req.body.options).then(unspents => {
    res.json({
      success: true,
      message: 'Unspents of ' + req.body.address,
      rdata: unspents
    });
  }).catch(next);
});


// multi

router.all('/fees', function(req, res, next) {
  lookup.fee(req.body).then(fees => {
    res.json({
      success: true,
      message: 'Average fees are',
      rdata: fees
    });
  }).catch(next);
});


module.exports = router;
