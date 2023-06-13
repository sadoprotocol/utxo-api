"use strict";

const fs = require('fs');
const { spawn } = require("child_process");

const dirPath = process.env.DIRECTORYPATH;

if (!fs.existsSync(dirPath)) {
  throw new Error('DIRECTORYPATH "' + dirPath + '" provided does not exists.');
}

function rpc(arg = []) {
  return new Promise((resolve, reject) => {
    let commandArg = [];

    commandArg.push("bin/index.js");

    commandArg = commandArg.concat(arg);

    const exec = spawn("node", commandArg, { cwd: dirPath });

    let output = '';

    exec.stdout.on("data", data => {
      output += data;
    });

    exec.stderr.on("data", data => {
      output += data;
    });

    exec.on('error', (error) => {
      console.log(`error: ${error.message}`);
      reject(`${error.message}`);
    });

    exec.on("close", code => {
      resolve(`${output}`);
    });
  });
}

exports.balance = balance;
exports.transaction = transaction;
exports.unconfirmed_transaction = unconfirmed_transaction;
exports.transactions = transactions;
exports.unconfirmed_transactions = unconfirmed_transactions;
exports.unspents = unspents;
exports.relay = relay;
exports.inscriptions = inscriptions;
exports.mempool_info = mempool_info;
exports.ord_indexing = ord_indexing;
exports.ord_indexer_status = ord_indexer_status;
exports.block_count = block_count;


async function balance(address) {
  let res = await rpc([ 'balance', address ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function transaction(txid, options = false) {
  let res = false;

  if (typeof options === 'object') {
    options = JSON.stringify(options);
    res = await rpc([ 'transaction', txid, options ]);
  } else {
    res = await rpc([ 'transaction', txid ]);
  }

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function unconfirmed_transaction(wtxid) {
  let res = await rpc([ 'unconfirmed_transaction', wtxid ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function transactions(address, options = false) {
  let res = false;

  if (typeof options === 'object') {
    options = JSON.stringify(options);
    res = await rpc([ 'transactions', address, options ]);
  } else {
    res = await rpc([ 'transactions', address ]);
  }

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function unconfirmed_transactions(options = {}) {
  options = JSON.stringify(options);

  let res = await rpc([ 'unconfirmed_transactions', true, options ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function unspents(address, options = false) {
  let res = false;

  if (typeof options === 'object') {
    options = JSON.stringify(options);
    res = await rpc([ 'unspents', address, options ]);
  } else {
    res = await rpc([ 'unspents', address ]);
  }

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function relay(hex) {
  let res = await rpc([ 'relay', hex ]);

  try {
    res = JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }

  if (res.includes('error')) {
    throw new Error(res);
  }

  return res;
}

async function inscriptions(outpoint) {
  let res = await rpc([ 'inscriptions', outpoint ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function mempool_info() {
  let res = await rpc([ 'mempool_info', true ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}

async function ord_indexing() {
  let res = await rpc([ 'indexing' ]);

  if (res.includes("true") || res === true) {
    return true;
  }

  return false;
}

async function ord_indexer_status() {
  let res = await rpc([ 'indexer_status' ]);

  try {
    res = JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }

  return res;
}

async function block_count() {
  let res = await rpc([ 'block_count', true ]);

  try {
    return JSON.parse(res);
  } catch (err) {
    throw new Error(res);
  }
}
