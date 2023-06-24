"use strict";

const { randomUUID } = require('crypto');
const fs = require('fs');
const { spawn } = require("child_process");
const http = require('http');

const dirPath = process.env.DIRECTORYPATH;
const rpcauth = process.env.RPCAUTH;
const rpcport = process.env.RPCPORT;

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

function special_relay(hex) {
  return new Promise((resolve, reject) => {
    const dataString = '{"jsonrpc": "1.0", "id": "curltest", "method": "sendrawtransaction", "params": ["' + hex + '"]}';

    const headers = {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(dataString),
    };

    const options = {
      hostname: '127.0.0.1',
      port: rpcport,
      method: 'POST',
      headers: headers,
      auth: rpcauth
    };

    let bodyRes = "";

    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        bodyRes = chunk;
        console.log(`BODY: ${chunk}`);
      });
      res.on('end', () => {
        resolve(bodyRes);
      });
    });

    req.on('error', (e) => {
      reject(e.message);
    });

    req.write(dataString);
    req.end(); 
  });
}

async function relay(hex) {
  let res = "";

  try {
    res = await rpc([ 'relay', hex ]);
  } catch (err) {
    let errorMessage = err.message || err;

    if (errorMessage.includes('spawn E2BIG')) {
      try {
        const filename = "relay-" + randomUUID();

        fs.writeFileSync("/tmp/" + filename, hex);

        res = await special_relay(hex);

        fs.unlinkSync("/tmp/" + filename);

        try {
          res = JSON.parse(res);

          if (res.result === null && res.error) {
            res = 'error: ' + res.error.message;
          } else {
            res = res.result;
          }
        } catch (err) {}
      } catch (err) {
        return "Unable to process long hex request.";
      }
    }
  }

  try {
    res = JSON.parse(res);

    if (res.includes('error')) {
      throw new Error(res);
    }
  } catch (err) {
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
