"use strict";

const express = require('express');
const router = express.Router();
const createError = require('http-errors');

const lookup = require('../src/lookup').use();
const utxo = require('../src/utxo');
const inscription = require('../src/inscription');
const cache = require('../src/cache');

const lookupFunctions = require('../src/lookup');

// no params

router.all('/inscriptions/:outpoint/:id/media', function(req, res, next) {
  inscription.media.get(req.params.outpoint, req.params.id).then(data => {
    let buff = Buffer.from(data.media_content, 'base64');

    res.writeHead(200, {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Type': data.media_type,
      'Content-Length': buff.length
    });
    res.end(buff);
  }).catch(next);
});

router.all('/inscriptions/:outpoint', function(req, res, next) {
  const outpoint = req.params.outpoint;

  utxo.inscriptions(outpoint).then(async data => {
    if (Array.isArray(data) && data.length) {
      for (let i = 0; i < data.length; i++) {
        const txid_arr = outpoint.split(":");
        const txid = txid_arr[0];
        const oipMeta = await lookupFunctions.getOip01meta(txid);

        if (oipMeta) {
          data[i].meta = oipMeta
        }
      }
    }

    return res.json({
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

router.all('/ord_indexing', function(req, res, next) {
  utxo.ord_indexing().then(result => {
    res.json({
      success: true,
      message: 'Is ord indexing?',
      rdata: result
    });
  }).catch(next);
});

router.all('/ord_indexer_status', function(req, res, next) {
  utxo.ord_indexer_status().then(result => {
    res.json({
      success: true,
      message: 'Status of each ord indexer',
      rdata: result
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
  const lookup = require('../src/lookup').use(process.env.RELAYMODE);

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
      rdata: result.txs.filter(t => {
        if (!t.blockheight) {
          return false;
        }

        return true;
      }),
      options: result.options
    });
  }).catch(next);
});

router.all('/unspents', function(req, res, next) {
  const lookup = require('../src/lookup');

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
