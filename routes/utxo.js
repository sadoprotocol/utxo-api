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
    utxo.ord_indexer_status().then(async (ordStatuses) => {
      let blockCount = await utxo.block_count();
      let safeHeight = 0;
      let allowedRarity = ["common", "uncommon"];

      if (
        req.body.options 
        && req.body.options.allowedrarity 
        && Array.isArray(req.body.options.allowedrarity)
      ) {
        allowedRarity = req.body.options.allowedrarity
      }

      if (typeof ordStatuses === 'object') {
        if (!isNaN(ordStatuses.first)) {
          safeHeight = ordStatuses.first;
        }

        if (!isNaN(ordStatuses.second)) {
          if (!isNaN(ordStatuses.first) && ordStatuses.first < ordStatuses.second) {
            safeHeight = ordStatuses.second;
          }
        }
      }

      if (Array.isArray(unspents) && unspents.length) {
        for (let i = 0; i < unspents.length; i++) {
          // === safe to spend

          let tx = unspents[i];
          let safeToSpend = true;
          let confirmation = null;

          if (tx.blockN) {
            safeToSpend = tx.blockN < safeHeight;
            confirmation = parseInt(blockCount) - tx.blockN;
          } else {
            safeToSpend = false;
          }

          // check for inscriptions
          if (safeToSpend) {
            if (tx.inscriptions && Array.isArray(tx.inscriptions) && tx.inscriptions.length) {
              safeToSpend = false;
            }
          }

          // check for rarity
          if (safeToSpend) {
            if (tx.ordinals && Array.isArray(tx.ordinals) && tx.ordinals.length) {
              for (let o = 0; o < tx.ordinals.length; o++) {
                let ordinal = tx.ordinals[o];

                if (allowedRarity.includes(ordinal.rarity)) {
                  // OK
                } else {
                  safeToSpend = false;
                  break;
                }
              }
            } else {
              safeToSpend = false;
            }
          }

          unspents[i].safeToSpend = safeToSpend;
          unspents[i].confirmation = confirmation;

          // === tx.hex

          if (
            req.body.options 
            && req.body.options.txhex 
          ) {
            try {
              let transaction = await lookup.transaction(unspents[i].txid);

              if (transaction && transaction.hex) {
                unspents[i].txhex = transaction.hex;
              }
            } catch (err) {
              //
            }
          }
        }

        if (req.body.options && req.body.options.notsafetospend) {
          unspents = unspents.filter(item => {
            return item.safeToSpend;
          });
        }
      }

      res.json({
        success: true,
        message: 'Unspents of ' + req.body.address,
        rdata: unspents
      });
    }).catch(next);
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
