"use strict";

const utxo = require('../src/utxo');

const network = process.env.BLOCKCYPHERNETWORK;
const rootUrl = process.env.BLOCKCYPHERURL;
const coin = process.env.BLOCKCYPHERCOIN;
const token = process.env.BLOCKCYPHERTOKEN;

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


function get(path, data = false) {
  if (path.indexOf('/') !== 0) {
    path = '/' + path;
  }

  let url = endpoint + path + '?token=' + token;

  let requestObject = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    requestObject.body = JSON.stringify(data);
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

async function transaction(txid) {
  return await utxo.transaction(txid);
}

async function transactions(address) {
  let txs = await get('addrs/' + address + '/full');

  let result = [];

  if (typeof txs === 'object' && txs.txs) {
    for (let i = 0; i < txs.txs.length; i++) {
      let tx = await utxo.transaction(txs.txs[i].hash);
      result.push(tx);
    }
  }

  return result;
}

async function unspents(address) {}


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
