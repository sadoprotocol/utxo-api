"use strict";

const utxo = require('../src/utxo');

const network = process.env.BLOCKCYPHERNETWORK;
const rootUrl = process.env.BLOCKCYPHERURL;
const coin = process.env.BLOCKCYPHERCOIN;
const token = process.env.BLOCKCYPHERTOKEN || false;

const resources = [
  {
    "network": "mainnet",
    "coin": "Bitcoin",
    "endpoint": "/btc/main",
    "decimals": 8
  },
  {
    "network": "testnet",
    "coin": "Bitcoin",
    "endpoint": "/btc/test3",
    "decimals": 8
  },
  {
    "network": "mainnet",
    "coin": "Litecoin",
    "endpoint": "/ltc/main",
    "decimals": 8
  }
];

let resourcesIndex = resources.findIndex(item => {
  return item.network === network && item.coin === coin;
});

if (resourcesIndex === -1) {
  throw new Error("Unable to find correct blockcypher resources. Please check env configuration.");
}

const endpoint = rootUrl + resources[resourcesIndex].endpoint;
const decimals = resources[resourcesIndex].decimals;


exports.balance = balance;
exports.transaction = transaction;
exports.transactions = transactions;
exports.unspents = unspents;
exports.relay = relay;
exports.fee = fee;


function get(path, data = false) {
  if (path.indexOf('/') !== 0) {
    path = '/' + path;
  }

  let url = endpoint + path;

  if (token) {
    url += '?token=' + token;
  }

  let requestObject = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (data && Object.keys(data).length !== 0) {
    requestObject.body = JSON.stringify(data);
    requestObject.method = 'POST';
  }

  return new Promise(resolve => {
    fetch (url, requestObject)
      .then(response => response.json())
      .then(response => resolve(response));
  });
}

async function balance(address) {
  let balance = await get('addrs/' + address + '/balance');

  return {
    int: balance.final_balance,
    value: intToStr(balance.final_balance, decimals)
  };
}

async function transaction(txid, options = false) {
  return await utxo.transaction(txid, options);
}

async function transactions(address, options = {}) {
  let url = 'addrs/' + address
  let data = {};

  console.log('retrieving blockcypher', url);

  if (options.limit !== undefined && !isNaN(options.limit)) {
    data.limit = options.limit;
  }

  if (options.before !== 0 && !isNaN(options.before)) {
    data.before = options.before;
  }

  let txs = await get(url, data);

  if (txs.hasMore) {
    options.before = txs.txrefs[txs.txrefs.length - 1].block_height;
  } else {
    options.before = false;
  }

  let result = [];

  if (typeof txs === 'object' && txs.txrefs) {
    for (let i = 0; i < txs.txrefs.length; i++) {
      let tx = await utxo.transaction(txs.txrefs[i].tx_hash, options);
      result.push(tx);
    }
  }

  return {
    txs: result,
    options
  }
}

async function unspents(address, options = false) {
  let bUnspents = await get('addrs/' + address + '?unspentOnly=true&includeScript=true');

  let result = [];

  if (typeof bUnspents === 'object' && bUnspents.txrefs) {
    for (let i = 0; i < bUnspents.txrefs.length; i++) {
      let u = bUnspents.txrefs[i];

      let data = {
        n: parseInt(u.tx_output_n),
        txHash: "",
        blockHash: "",
        blockN: parseInt(u.block_height),
        sats: u.value,
        scriptPubKey: {},
        txid: "",
        value: 0,
        ordinals: [],
        inscriptions: []
      }

      let tx = await utxo.transaction(u.tx_hash, options);

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
  }

  return result;
}

async function relay(hex) {
  let relayed = await get('txs/push', {
    tx: hex
  });

  if (!relayed.tx) {
    return relayed;
  }

  return relayed.tx.hash;
}

async function fee(params) {
  let old = params.old || 5;
  let older = params.older || 15;
  let default_fee = params.defaultFee || 100;

  // ==

  let chain = await chainInfo();

  // ==

  let currentBlock = await block(chain.height);

  let txs1 = currentBlock.n_tx;
  let fees1 = currentBlock.fees;
  let size1 = currentBlock.size;
  let vsize1 = currentBlock.vsize;
  let average1 = parseInt(fees1 / txs1);

  // ==

  let oldBlock = await block(chain.height - old);

  let txs2 = oldBlock.n_tx;
  let fees2 = oldBlock.fees;
  let size2 = oldBlock.size;
  let vsize2 = oldBlock.vsize;
  let average2 = parseInt(fees2 / txs2);

  // ==

  let olderBlock = await block(chain.height - older);

  let txs3 = olderBlock.n_tx;
  let fees3 = olderBlock.fees;
  let size3 = olderBlock.size;
  let vsize3 = olderBlock.vsize;
  let average3 = parseInt(fees3 / txs3);

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
      block: chain.height,
      size: size1,
      vsize: vsize1
    },
    old: {
      txs: txs2,
      fee: fees2,
      average: average2,
      block: chain.height - old,
      size: size2,
      vsize: vsize2
    },
    older: {
      txs: txs3,
      fee: fees3,
      average: average3,
      block: chain.height - older,
      size: size3,
      vsize: vsize3
    },
    average: averageFee
  }

  return fee_object;
}


// ==

async function chainInfo() {
  return await get('');
}

async function block(height) {
  return await get('blocks/' + height);
}

function intToStr(num, decimal) {
  if (typeof num === 'string') {
    num = num.replace(',', '');
  } else {
    num = num.toLocaleString('fullwide', {useGrouping:false});
  }

  BigDecimal.decimals = decimal; // Configuration of the number of decimals you want to have.

  let a = new BigDecimal(num);
  let b = new BigDecimal("1" + "0".repeat(decimal));

  return a.divide(b).toString();
}

class BigDecimal {
  constructor(value) {
    let [ints, decis] = String(value).split(".").concat("");
    decis = decis.padEnd(BigDecimal.decimals, "0");
    this.bigint = BigInt(ints + decis);
  }
  static fromBigInt(bigint) {
    return Object.assign(Object.create(BigDecimal.prototype), { bigint });
  }
  divide(divisor) { // You would need to provide methods for other operations
    return BigDecimal.fromBigInt(this.bigint * BigInt("1" + "0".repeat(BigDecimal.decimals)) / divisor.bigint);
  }
  toString() {
    const s = this.bigint.toString().padStart(BigDecimal.decimals+1, "0");
    return s.slice(0, -BigDecimal.decimals) + "." + s.slice(-BigDecimal.decimals);
  }
}
