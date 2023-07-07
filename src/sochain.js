"use strict";

const utxo = require('../src/utxo');

const network = process.env.SOCHAINNETWORK;
const endpoint = process.env.SOCHAINURL;
const coin = process.env.SOCHAINCOIN;
const token = process.env.SOCHAINTOKEN || false;

const resources = [
  {
    "network": "BTC",
    "coin": "Bitcoin",
    "decimals": 8
  },
  {
    "network": "BTCTEST",
    "coin": "Bitcoin",
    "decimals": 8
  },
  {
    "network": "LTC",
    "coin": "Litecoin",
    "decimals": 8
  },
  {
    "network": "LTCTEST",
    "coin": "Litecoin",
    "decimals": 8
  }
];

let resourcesIndex = resources.findIndex(item => {
  return item.network === network && item.coin === coin;
});

if (resourcesIndex === -1) {
  throw new Error("Unable to find correct sochain resources. Please check env configuration.");
}

const decimals = resources[resourcesIndex].decimals;


exports.balance = balance;
exports.transaction = transaction;
exports.transactions = transactions;
exports.unspents = unspents;
exports.relay = relay;
exports.fee = fee;
exports.usage = usage;


function get(path, data = false) {
  if (path.indexOf('/') !== 0) {
    path = '/' + path;
  }

  let url = endpoint + path;

  let requestObject = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'API-KEY': token
    }
  };

  if (data && Object.keys(data).length !== 0) {
    requestObject.body = JSON.stringify(data);
    requestObject.method = 'POST';
  }

  return new Promise((resolve, reject) => {
    fetch (url, requestObject)
      .then(response => response.json())
      .then(response => {
        if (response.status === 'fail' && response.data && response.data.error_message) {
          reject(new Error("SoChain: " + response.data.error_message));
        } else {
          resolve(response)
        }
      })
      .catch(reject);
  });
}

async function balance(address) {
  let balance = await get('address_summary/' + network + '/' + address);

  return {
    int: toInt(balance.data.confirmed_balance, decimals),
    value: balance.data.confirmed_balance
  };
}

async function transaction(txid, options = false) {
  return await utxo.transaction(txid, options);
}

async function transactions(address, options = {}) {
  try {
    if (!options.before || isNaN(options.before)) {
      options.before = 1;
    }

    let url = 'transactions/' + network + '/' + address + '/' + options.before;

    console.log('retrieving sochain', url);

    let txs = await get(url);

    if (options.unconfirmed.length) {
      txs.data.transactions = [...options.unconfirmed, ...txs.data.transactions];
    }

    let result = [];

    if (txs.data.transactions && txs.data.transactions.length) {
      for (let i = 0; i < txs.data.transactions.length; i++) {
        if (txs.data.transactions[i].hash) {
          let tx = false;

          try {
            tx = await utxo.transaction(txs.data.transactions[i].hash, options);
          } catch (err) {
            console.log('Error ' + txs.data.transactions[i].hash, err);
          }

          if (tx) {
            result.push(tx);
          }
        }
      }

      options.before++;
    } else {
      options.before = false;
    }

    return {
      txs: result,
      options
    }
  } catch (err) {
    options.before = false;

    return {
      txs: [],
      options
    }
  }
}

async function unspents(address, options = false) {
  let result = [];
  let page = 1;
  let bUnspents = {}

  try {
    bUnspents = await get('unspent_outputs/' + network + '/' + address + '/' + page);
  } catch (err) {
    bUnspents = {};
  }

  while(bUnspents.status === 'success' && bUnspents.data && Array.isArray(bUnspents.data.outputs) && bUnspents.data.outputs.length) {
    for (let i = 0; i < bUnspents.data.outputs.length; i++) {
      let u = bUnspents.data.outputs[i];

      if (!u.block) {
        continue;
      }

      let data = {
        n: parseInt(u.index),
        txHash: "",
        blockHash: "",
        blockN: parseInt(u.block),
        sats: toInt(u.value, decimals),
        scriptPubKey: {},
        txid: "",
        value: 0,
        ordinals: [],
        inscriptions: []
      }

      let tx = await utxo.transaction(u.hash, options);

      if (tx) {
        data.txid = tx.txid;
        data.txHash = tx.hash;
        data.blockHash = tx.blockhash;

        let voutIndex = tx.vout.findIndex(item => {
          return item.n === data.n;
        });

        if (voutIndex !== -1) {
          data.scriptPubKey = tx.vout[voutIndex].scriptPubKey;
          data.ordinals = tx.vout[voutIndex].ordinals;
          data.inscriptions = tx.vout[voutIndex].inscriptions;
          data.value = tx.vout[voutIndex].value;

          result.push(data);
        }
      }
    }

    page++;

    try {
      bUnspents = await get('unspent_outputs/' + network + '/' + address + '/' + page);
    } catch (err) {
      bUnspents = {};
    }
  }

  return result;
}

async function relay(hex) {
  let relayed = await get('broadcast_transaction/' + network, {
    tx_hex: hex
  });

  return relayed.data.hash;
}

async function fee(params) {
  let block2 = parseInt(params.old) || 5;
  let block3 = parseInt(params.older) || 15;
  let default_fee = params.defaultFee || 100;

  // ==

  let chain = await getLatestBlocks(params);

  if (!chain) {
    throw new Error("Unable to retrieve last block information.");
  }

  params.height = chain[0].height;

  let currentBlock = await getBlock(params);
  // console.log('currentBlock', currentBlock);
  let txs1 = currentBlock.num_txs;
  let fees1 = parseInt(toInt(currentBlock.fees, decimals));
  let average1 = parseInt(fees1 / txs1);
  let size1 = currentBlock.size;
  let spb1 = fees1 / size1;

  // ==

  params.height = currentBlock.height - block2;

  let oldBlock = await getBlock(params);
  // console.log('oldBlock', oldBlock);
  let txs2 = oldBlock.num_txs;
  let fees2 = parseInt(toInt(oldBlock.fees, decimals));
  let average2 = parseInt(fees2 / txs2);
  let size2 = oldBlock.size;
  let spb2 = fees2 / size2;

  // ==

  params.height = currentBlock.height - block3;

  let olderBlock = await getBlock(params);
  // console.log('olderBlock', olderBlock);
  let txs3 = olderBlock.num_txs;
  let fees3 = parseInt(toInt(olderBlock.fees, decimals));
  let average3 = parseInt(fees3 / txs3);
  let size3 = olderBlock.size;
  let spb3 = fees3 / size3;

  // ==

  if (fees1 < default_fee) average1 = default_fee;
  if (fees2 < default_fee) average2 = default_fee;
  if (fees3 < default_fee) average3 = default_fee;

  let averageFee = parseInt((average1 + average2 + average3) / 3);

  // ==

  let fee_object = {
    current: {
      txs: txs1,
      fee: fees1,
      average: average1,
      block: currentBlock.height,
      size: size1,
      vsize: size1,
      satsPerByte: spb1
    },
    old: {
      txs: txs2,
      fee: fees2,
      average: average2,
      block: oldBlock.height,
      size: size2,
      vsize: size2,
      satsPerByte: spb2
    },
    older: {
      txs: txs3,
      fee: fees3,
      average: average3,
      block: olderBlock.height,
      size: size3,
      vsize: size3,
      satsPerByte: spb3
    },
    average: averageFee
  }

  return fee_object;
}

async function usage() {
  try {
    let res = await get('account_info');

    return {
      "current": res.num_requests_used.today,
      "total": res.plan.max_daily_requests
    }
  } catch (err) {
    return {
      "current": 1,
      "total": 1
    }
  }
}


// ==

async function getLatestBlocks() {
  let res = await get('latest_blocks_summary/' + network);
  return res.data.blocks;
}

async function getBlock(params) {
  let height = params.height || '';
  let res = await get('block/' + network + '/' + height);
  return res.data;
}

function toInt(num, dec) {
  let shift = parseFloat(num) * (10 ** dec);

  return parseInt(shift.toLocaleString('fullwide', {useGrouping:false}));
}
