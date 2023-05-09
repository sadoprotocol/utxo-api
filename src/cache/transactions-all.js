"use strict";

// Both direction incoming and outgoing

const Mongo = require('../../src/mongodb');

const utxo = require('../../src/utxo');
const blockcypher = require('../../src/blockcypher');

const lookupMode = process.env.LOOKUPMODE;
const repeaterWait = process.env.CACHEREPEATER || 5;

var lookup;
var busy = false;

if (lookupMode === 'utxo') {
  lookup = utxo;
} else if (lookupMode === 'blockcypher') {
  lookup = blockcypher;
} else {
  throw new Error("Unknown lookup mode.");
}


exports.prepare = prepare;
exports.fetch = fetch;
exports.refresh = refresh;



async function prepare() {
  // Create collection and indexes
  let createCollections = [ 'cache_transactions_all' ];
  let createCollectionsIndex = {
    "cache_transactions_all": [
      {
        "address": 1,
        "confirmation": 1,
        "sado": 1
      },
      {
        "address": 1,
        "confirmation": -1,
        "sado": 1
      },
      {
        "address": 1,
        "sado": 1
      },
      {
        "address": 1,
        "txid": 1
      },
    ]
  };

  await Mongo.createCollectionAndIndexes(createCollections, createCollectionsIndex);

  await repeater();
  setInterval(async () => {
    await repeater();
  }, repeaterWait * 60000);
}

async function fetch(params) {
  let address = params.address || false;
  let confirmationSort = params.confirmationSort || 1;
  let sado = params.sado || false;

  if (!address) {
    throw new Error("Expecting address.");
  }

  if (confirmationSort === -1 || confirmationSort === 1) {
    // OK
  } else {
    throw new Error('Invalid confirmationSort value.');
  }

  if (sado && !Array.isArray(sado)) {
    throw new Error('Invalid sado value.');
  }

  const db = Mongo.getClient();

  let pipelines = [];

  let match = {
    "address": address
  };

  let sort = {
    "address": 1,
    "confirmation": 1
  }

  if (sado) {
    match['sado'] = { $in: sado };
    sort['sado'] = 1;
  }

  pipelines.push({
    $match: match
  });
  pipelines.push({
    $sort: sort
  });
  pipelines.push({
    $project: {
      _id: 0,
      address: 0,
      sado: 0
    }
  });

  let result = await db.collection("cache_transactions_all").aggregate(pipelines, { allowDiskUse:true }).toArray();

  if (result && Array.isArray(result) && result.length) {
    return result;
  }

  return await refresh(params);
}

async function refresh(params) {
  let address = params.address || false;

  if (!address) {
    throw new Error("Expecting address.");
  }

  let transactions = await lookup.transactions(address);

  if (transactions && Array.isArray(transactions) && transactions.length) {
    const db = Mongo.getClient();

    for (let i = 0; i < transactions.length; i++) {
      let tx = transactions[i];

      tx.address = address;
      
      // check if has sado
      for (let o = 0; o < tx.vout.length; o++) {
        if (tx.vout[o].scriptPubKey && tx.vout[o].scriptPubKey.utf8 && tx.vout[o].scriptPubKey.utf8.indexOf('sado=') === 0) {
          tx.sado = [];

          if (tx.vout[o].scriptPubKey.utf8.indexOf('sado=offer') === 0) {
            tx.sado.push('offer');
          }

          if (tx.vout[o].scriptPubKey.utf8.indexOf('sado=order') === 0) {
            tx.sado.push('order');
          }
        }
      }

      await db.collection("cache_transactions_all").updateOne({
        "address": address,
        "txid": tx.txid
      }, {
        $set: tx
      }, {
        upsert: true
      });
    }
  }

  return transactions;
}

async function repeater() {
  if (busy) {
    console.log('Still busy..');
    return false;
  }

  busy = true;

  const db = Mongo.getClient();

  let pipelines = [];

  pipelines.push({
    $group: {
      _id: "$address",
      count: {
        $sum: 1
      }
    }
  });

  let result = await db.collection("cache_transactions_all").aggregate(pipelines, { allowDiskUse:true }).toArray();

  if (result && Array.isArray(result) && result.length) {
    for (let i = 0; i < result.length; i++) {
      await refresh({
        address: result[i]._id
      });
    }
  }

  busy = false;
}
