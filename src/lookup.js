"use strict";

const Mongo = require('../src/mongodb');

const utxo = require('../src/utxo');
const blockcypher = require('../src/blockcypher');
const sochain = require('../src/sochain');
const rpc = require('../src/rpc');

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
        safeToSpend = tx.blockN <= safeHeight;
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

      // === OIP-01: Meta
      if (
        options.oips 
        && options.oips === true
        && tx.inscriptions 
        && Array.isArray(tx.inscriptions) 
        && tx.inscriptions.length
      ) {
        const oip01meta = await getOip01meta(result[i].txid);

        if (oip01meta) {
          tx.inscriptions.map(v => {
            v.meta = oip01meta;
            return v;
          });
        }
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

async function getOip01meta(txid) {
  const lookup = use();

  let result = null;
  let tx = await lookup.transaction(txid, { noord: true });

  if (tx && Array.isArray(tx.vin) && tx.vin.length) {
    for (let i = 0; i < tx.vin.length; i++) {
      if (
        tx.vin[i].txinwitness 
        && Array.isArray(tx.vin[i].txinwitness) 
      ) {
        for (let m = 0; m < tx.vin[i].txinwitness.length; m++) {
          let oip1MetaIndex = tx.vin[i].txinwitness.findIndex(witnessItem => {
            // 6170706c69636174696f6e2f6a736f6e3b636861727365743d7574662d38 = application/json;charset=utf-8
            return witnessItem.includes("6170706c69636174696f6e2f6a736f6e3b636861727365743d7574662d38");
          });

          if (oip1MetaIndex !== -1) {
            let decodedScript = await rpc.decodeScript(tx.vin[i].txinwitness[oip1MetaIndex]);

            if (decodedScript && decodedScript.asm) {
              let splits = decodedScript.asm.split(" ");
              let splitIndex = splits.findIndex(item => {
                return item === "6170706c69636174696f6e2f6a736f6e3b636861727365743d7574662d38";
              });

              let buildString = "";
              let lookIndex = splitIndex + 2;

              while(lookIndex !== false) {
                let val = splits[lookIndex];

                if (val === undefined || val === "0" || val.includes("OP")) {
                  lookIndex = false;
                } else {
                  buildString += splits[lookIndex];
                  lookIndex++;
                }
              }

              if (buildString.trim() !== "") {
                try {
                  result = JSON.parse(Buffer.from(buildString, 'hex').toString("utf8"));
                } catch (err) {}
              }
            }
          }
        }
      }
    }
  }

  return result;
}
