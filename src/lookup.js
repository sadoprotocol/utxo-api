"use strict";

const Mongo = require('../src/mongodb');

const utxo = require('../src/utxo');
const blockcypher = require('../src/blockcypher');
const sochain = require('../src/sochain');

const lookupMode = process.env.LOOKUPMODE;

const providers = {
  'utxo': utxo,
  'blockcypher': blockcypher,
  'sochain': sochain
};

if (!providers[lookupMode]) {
  throw new Error("Invalid lookup mode");
}

exports.provider = lookupMode;
exports.use = use;
exports.unspents = unspents;



function use(provider = false) {
  if (provider && !providers[provider]) {
    throw new Error("Invalid provider.");
  }

  if (provider) {
    return providers[provider];
  }

  return providers[lookupMode];
}

const txhexTypesAllowed = ["pubkey", "pubkeyhash", "multisig"];

async function unspents(address, options = {}) {
  const lookup = use();

  let result = await lookup.unspents(address, options);
  let ordStatuses = await utxo.ord_indexer_status();

  let blockCount = await utxo.block_count();
  let safeHeight = 0;
  let allowedRarity = ["common", "uncommon"];

  if (
    options.allowedrarity 
    && Array.isArray(options.allowedrarity)
  ) {
    allowedRarity = options.allowedrarity
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

  if (Array.isArray(result) && result.length) {
    for (let i = 0; i < result.length; i++) {
      // === safe to spend

      let tx = result[i];
      let safeToSpend = true;
      let confirmation = null;

      if (tx.blockN) {
        safeToSpend = tx.blockN < safeHeight;
        confirmation = parseInt(blockCount) + 1 - tx.blockN;
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

      result[i].safeToSpend = safeToSpend;
      result[i].confirmation = confirmation;

      // === tx.hex

      if (
        options.txhex 
        && result[i].scriptPubKey
        && result[i].scriptPubKey.type
        && txhexTypesAllowed.includes(result[i].scriptPubKey.type.toLowerCase())
      ) {
        result[i].txhex = await txHex(result[i].txid);
      }
    }

    if (options.notsafetospend) {
      result = result.filter(item => {
        return item.safeToSpend;
      });
    }
  }

  return result;
}

async function txHex(txid) {
  const db = Mongo.getClient();
  const lookup = use();

  let cacheTxHex = await db.collection("txid_hex").findOne({ txid });

  if (cacheTxHex) {
    return cacheTxHex.hex;
  }

  let transaction = await lookup.transaction(txid, { noord: true });

  if (!transaction || !transaction.hex) {
    return false;
  }

  await db.collection("txid_hex").updateOne({
    txid
  }, {
    $set: {
      txid,
      "hex": transaction.hex
    }
  }, {
    upsert: true
  });

  return transaction.hex;
}
