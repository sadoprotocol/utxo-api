"use strict";

// Both direction incoming and outgoing

const Mongo = require('../../src/mongodb');

const utxo = require('../../src/utxo');
const blockcypher = require('../../src/blockcypher');
const sochain = require('../../src/sochain');

const lookupMode = process.env.LOOKUPMODE;
const repeatDurationDelay = process.env.CACHEREPEATER;
const cacheExpiryHour = process.env.CACHEEXPIRYHOUR;

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
      },
      {
        "address": 1,
        "txid": 1
      },
      {
        "address": 1,
        "time": -1
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

  if (options.noord === undefined) {
    options.noord = false;
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

  if (!options.before || isNaN(options.before)) {
    options.before = 0;
  }

  if (!options.after || isNaN(options.after)) {
    options.after = 0;
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

  const db = Mongo.getClient();

  let options = transactions_options({});
  let foundExist = false;
  let result = false;

  options.unconfirmed = [];

  let unconfirmedCursor = await db.collection("api_address_transactions").find({
    "address": address,
    "blockheight": null
  });

  while(await unconfirmedCursor.hasNext()) {
    const doc = await unconfirmedCursor.next();

    options.unconfirmed.push({
      hash: doc.hash
    });
  }

  while(options.before !== false) {
    result = await lookup.transactions(address, options);
    options = result.options;

    if (result && Array.isArray(result.txs) && result.txs.length) {
      for (let i = 0; i < result.txs.length; i++) {
        let tx = result.txs[i];

        tx.address = address;

        let hasUnconfirmed = false;

        if (options.unconfirmed.length) {
          let foundUnconfirmedIndex = options.unconfirmed.findIndex(item => {
            return item.hash === tx.hash;
          });

          if (foundUnconfirmedIndex !== 1) {
            hasUnconfirmed = true;
          }
        }

        let exist = await db.collection("api_address_transactions").findOne({
          "address": address,
          "txid": tx.txid
        });

        if (exist && !hasUnconfirmed) {
          foundExist = true;
          console.log('found exists.');
          break;
        }

        await db.collection("api_address_transactions").updateOne({
          "address": address,
          "txid": tx.txid
        }, {
          $set: tx
        }, {
          upsert: true
        });
      }

      if (foundExist) {
        break;
      }
    } else {
      console.log('no more results.');
    }
  }

  if (foundExist) {
    let cursor = await db.collection("api_address_transactions").find({
      "address": address
    });

    cursor.sort({ "time": -1 });

    while(await cursor.hasNext()) {
      const doc = await cursor.next();

      let tx = await lookup.transaction(doc.txid);

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
}

async function refresh(address, options) {
  options = JSON.parse(JSON.stringify(options));

  if (lookupMode === 'utxo') {
    await utxo.transactions(address, options);
  } else {
    await refresh_api(address);
  }
}

async function get_address_blocktip(database, address, rightAfter = false, inclusive = false) {
  const db = Mongo.getClient();

  let pipelines = [];

  let match = {
    "address": address
  };

  if (rightAfter) {
    if (inclusive) {
      match.blockheight = { $gte: rightAfter };
    } else {
      match.blockheight = { $gt: rightAfter };
    }
  }

  let sort = {
    "address": 1,
    "blockheight": -1
  }

  if (rightAfter) {
    sort.blockheight = 1;
  }

  pipelines.push({
    $match: match
  });
  pipelines.push({
    $sort: sort
  });
  pipelines.push({
    $limit: 1
  });

  let cursor = db.collection(database).aggregate(pipelines);
  let blockheight = 0;

  while(await cursor.hasNext()) {
    const doc = await cursor.next();
    blockheight = doc.blockheight;
    break;
  }

  return blockheight;
}

async function get_address_blockfloor(database, address, rightBefore = false, inclusive = false) {
  const db = Mongo.getClient();

  let pipelines = [];

  let match = {
    "address": address
  };

  if (rightBefore) {
    if (inclusive) {
      match.blockheight = { $lte: rightBefore };
    } else {
      match.blockheight = { $lt: rightBefore };
    }
  }

  let sort = {
    "address": 1,
    "blockheight": 1
  }

  if (rightBefore) {
    sort.blockheight = -1;
  }

  pipelines.push({
    $match: match
  });
  pipelines.push({
    $sort: sort
  });
  pipelines.push({
    $limit: 1
  });

  let cursor = db.collection(database).aggregate(pipelines);
  let blockheight = 0;

  while(await cursor.hasNext()) {
    const doc = await cursor.next();
    blockheight = doc.blockheight;
    break;
  }

  return blockheight;
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

  let reverse = false;
  let negate = false;

  if (options.after !== 0 && !isNaN(options.after)) {
    if (typeof match.blockheight === 'object') {
      negate = true;
      match.blockheight = { 
        $lte: options.before,
        $gte: options.after
      };
    } else {
      reverse = true;
      match.blockheight = { $gte: options.after };
    }
  }

  let sort = {
    "address": 1,
    "blockheight": -1
  }

  if (reverse) {
    sort.blockheight = 1;
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

  if (options.noord) {
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
  let result = [];
  let height = 0;
  let blockheight = 0;

  while(await cursor.hasNext()) {
    const doc = await cursor.next();

    if (reverse) {
      if (!blockheight) {
        blockheight = doc.blockheight;
      }

      if (height === doc.blockheight) {
        // don't do anything
      } else if (result.length >= options.limit) {
        height = doc.blockheight;
        break;
      }

      result.unshift(doc);
      height = doc.blockheight;
    } else {
      if (!height) {
        height = doc.blockheight;
      }

      if (blockheight === doc.blockheight) {
        // don't do anything
      } else if (result.length >= options.limit) {
        blockheight = doc.blockheight;
        break;
      }

      result.push(doc);
      blockheight = doc.blockheight;
    }
  }

  options.after = await get_address_blocktip(database, address, height, reverse);
  if (negate) {
    reverse = !reverse;
  }
  options.before = await get_address_blockfloor(database, address, blockheight, !reverse);

  // ==

  let addressBlockFloor = await get_address_blockfloor(database, address);

  if (addressBlockFloor === blockheight) {
    options.before = false;
  }

  let addressBlockTip = await get_address_blocktip(database, address);

  if (addressBlockTip === height) {
    options.after = false;
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
    } else {
      database = 'api_address_transactions';
    }

    await add_to_address_collection(address);

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

async function add_to_address_collection(address) {
  const db = Mongo.getClient();

  let data = {
    address,
    requested: new Date()
  };

  await db.collection("address_collection").updateOne({
    "address": address
  }, {
    $set: data
  }, {
    upsert: true
  });
}

async function repeater() {
  console.log("Repeating execution");

  const db = Mongo.getClient();

  let now = (new Date()).getTime();
  let cursor = db.collection("address_collection").find({});

  while(await cursor.hasNext()) {
    const doc = await cursor.next();

    let then = date_add_hours(new Date(doc.requested), cacheExpiryHour);
    then = then.getTime();

    if (now < then) {
      await refresh_api(doc.address);
    }
  }

  await new Promise(resolve => setTimeout(resolve, repeatDurationDelay * 3600000));
  await repeater();
}

// ==

function date_add_hours(dateObject, h) {
  h = parseInt(h);
  dateObject.setTime(dateObject.getTime() + (h * 60 * 60 * 1000));
  return dateObject;
}
