"use strict";

// Both direction incoming and outgoing

const Mongo = require('../../src/mongodb');

const utxo = require('../../src/utxo');
const blockcypher = require('../../src/blockcypher');

const lookupMode = process.env.LOOKUPMODE;
const repeaterWait = process.env.CACHEREPEATER || 5;

var lookup;

if (lookupMode === 'utxo') {
  lookup = utxo;
} else if (lookupMode === 'blockcypher') {
  lookup = blockcypher;
} else {
  throw new Error("Unknown lookup mode.");
}


exports.prepare = prepare;
exports.fetch = fetch;



async function prepare() {
  // Create collection and indexes
  let createCollections = [ 'api_address_transactions' ];
  let createCollectionsIndex = {
    "api_address_transactions": [
      {
        "address": 1,
        "blockheight": 1
      },
      {
        "address": 1,
        "blockheight": -1
      }
    ]
  };

  await Mongo.createCollectionAndIndexes(createCollections, createCollectionsIndex);

  repeater().catch(err => {
    console.log("Lookup transactions repeater uncought error", err);
  });
}

// ==

function transactions_options(options) {
  options = JSON.parse(JSON.stringify(options));

  if (options.ord === undefined) {
    options.ord = true;
  }

  if (!options.limit || isNaN(options.limit)) {
    options.limit = 50;
  }

  if (options.nohex === undefined) {
    options.nohex = false;
  }

  if (options.nowitness === undefined) {
    options.nowitness = false;
  }


  if (options.before === undefined || isNaN(options.before)) {
    options.before = 0;
  }

  return options;
}

async function refresh_api(address) {
  if (!address) {
    throw new Error("Expecting address.");
  }

  if (lookupMode === 'utxo') {
    throw new Error("Incorrect process.");
  }

  console.log('transactions ' + address);

  let result = await lookup.transactions(address);

  if (
    result.txs 
    && result.txs.length 
    && result.options 
    && result.options.before === false
  ) {
    result.options.before = 0;
  }

  while(result.options.before !== false) {
    if (result && Array.isArray(result.txs) && result.txs.length) {
      const db = Mongo.getClient();

      for (let i = 0; i < result.txs.length; i++) {
        let tx = result.txs[i];

        tx.address = address;

        await db.collection("api_address_transactions").updateOne({
          "address": address,
          "txid": tx.txid
        }, {
          $set: tx
        }, {
          upsert: true
        });
      }
    }

    result = await lookup.transactions(address, result.options);
  }
}

async function refresh(address, options) {
  options = JSON.parse(JSON.stringify(options));

  if (lookupMode === 'utxo') {
    await utxo.transactions(address, options);
  } else if (lookupMode === 'blockcypher') {
    await refresh_api(address);
  }
}

async function got_cache_transactions(database, address, options) {
  options = JSON.parse(JSON.stringify(options));

  if (!database) {
    throw new Error("Expecting database.");
  }

  if (!address) {
    throw new Error("Expecting address.");
  }

  const db = Mongo.getClient();

  let pipelines = [];

  let match = {
    "address": address
  };

  if (options.before !== 0 && !isNaN(options.before)) {
    match.blockheight = { $lte: options.before };
  }

  let sort = {
    "address": 1,
    "blockheight": -1
  }

  pipelines.push({
    $match: match
  });
  pipelines.push({
    $sort: sort
  });

  let project = {
    _id: 0,
    address: 0
  }

  if (!options.ord) {
    project['vout.ordinals'] = 0;
    project['vout.inscriptions'] = 0;
  }

  if (options.nohex) {
    project.hex = 0;
  }

  if (options.nowitness) {
    project['vin.txinwitness'] = 0;
  }

  pipelines.push({
    $project: project
  });

  let cursor = db.collection(database).aggregate(pipelines, { allowDiskUse:true });
  let counter = 0;
  let result = [];
  let blockheight = 0;

  while(await cursor.hasNext()) {
    counter++;

    const doc = await cursor.next();

    if (blockheight === doc.blockheight) {
      // don't do anything
    } else if (result.length >= options.limit) {
      blockheight = doc.blockheight;
      break;
    }

    result.push(doc);
    blockheight = doc.blockheight;
  }

  options.before = blockheight;

  if (counter < options.limit) {
    options.before = false;
  }

  return {
    txs: result,
    options
  }
}

async function fetch(address, options = {}) {
  options = JSON.parse(JSON.stringify(options));

  return new Promise(async (resolve, reject) => {
    options = transactions_options(options);
    let database = false;

    if (lookupMode === 'utxo') {
      database = 'address_transactions';
    } else if (lookupMode === 'blockcypher') {
      database = 'api_address_transactions';
    }

    try {
      let gotCache = await got_cache_transactions(database, address, options);

      if (gotCache && gotCache.txs && gotCache.txs.length) {
        resolve(gotCache);
        return;
      }

      setTimeout(async () => {
        resolve(await got_cache_transactions(database, address, options));
      }, 95000);

      await refresh(address, options);

      resolve(await got_cache_transactions(database, address, options));
    } catch (err) {
      reject(err);
    }
  });
}

async function repeater() {
  console.log("Repeating executing");

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

  let cursor = db.collection("api_address_transactions").aggregate(pipelines, { allowDiskUse: true });
  let counter = 0;

  while(await cursor.hasNext()) {
    counter++;
    const doc = await cursor.next();
    await refresh_api(doc._id);
  }

  if (counter < 50) {
    await new Promise(resolve => setTimeout(resolve, 300000));
    await repeater();
  } else {
    await repeater();
  }
}
