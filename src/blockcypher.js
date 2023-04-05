"use strict";

const network = process.env.BLOCKCYPHERNETWORK;
const rootUrl = process.env.BLOCKCYPHERURL;
const coin = process.env.BLOCKCYPHERCOIN;
const token = process.env.BLOCKCYPHERTOKEN;

const resources = [
  {
    "network": "mainnet",
    "coin": "Bitcoin",
    "endpoint": "/btc/main"
  },
  {
    "network": "testnet",
    "coin": "Bitcoin",
    "endpoint": "/btc/test3"
  },
  {
    "network": "mainnet",
    "coin": "Litecoin",
    "endpoint": "/ltc/main"
  }
];

let resourcesIndex = resources.findIndex(item => {
  return item.network === network && item.coin === coin;
});

if (resourcesIndex === -1) {
  throw new Error("Unable to find correct blockcypher resources. Please check env configuration.");
}

const endpoint = rootUrl + resources[resourcesIndex].endpoint;


exports.balance = balance;
exports.transaction = transaction;
exports.transactions = transactions;
exports.unspents = unspents;


function get(path) {
  if (path.indexOf('/') !== 0) {
    path = '/' + path;
  }

  let url = endpoint + path + '?token=' + token;

  return new Promise(resolve => {
    fetch (url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(response => resolve(response));
  });
}

async function balance(address) {
  let balance = await get('addrs/' + address + '/balance');

  return balance;
}

async function transaction() {}

async function transactions() {}

async function unspents() {}
