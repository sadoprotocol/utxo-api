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
exports.transactions = transactions;
exports.unspents = unspents;


async function balance(address) {
  let res = await rpc([ 'balance', address ]);
  return JSON.parse(res);
}

async function transactions(address) {
  let res = await rpc([ 'transactions', address ]);
  return JSON.parse(res);
}

async function unspents(address) {
  let res = await rpc([ 'unspents', address ]);
  return JSON.parse(res);
}
