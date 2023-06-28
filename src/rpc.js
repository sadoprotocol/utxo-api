"use strict";
const http = require('http');

const rpcauth = process.env.RPCAUTH;
const rpchost = process.env.RPCHOST;
const rpcport = process.env.RPCPORT;

function rpc(method, args = []) {
  return new Promise((resolve, reject) => {
    let parseString = "";

    for (let i = 0; i < args.length; i++) {
      if (i > 0) {
        parseString += ", ";
      }

      if (typeof args[i] === 'string') {
        parseString += '"' + args[i] + '"';
      } else {
        parseString += '' + args[i];
      }
    }

    const dataString = '{"jsonrpc": "1.0", "id": "curltest", "method": "' + method + '", "params": [' + parseString + ']}';

    const headers = {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(dataString),
    };

    const options = {
      hostname: rpchost,
      port: rpcport,
      method: 'POST',
      headers: headers,
      auth: rpcauth
    };

    let bodyRes = "";

    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        bodyRes += chunk;
      });
      res.on('end', () => {
        try {
          bodyRes = JSON.parse(bodyRes);

          if (bodyRes.result === null && bodyRes.error) {
            reject(bodyRes.error.message);
          } else {
            resolve(bodyRes.result);
          }
        } catch (err) {
          resolve(bodyRes);
        }
      });
    });

    req.on('error', (e) => {
      reject(e.message);
    });

    req.write(dataString);
    req.end(); 
  });
}

exports.decodeScript = decodeScript;
exports.sendRawTransaction = sendRawTransaction;


async function decodeScript(hex) {
  return await rpc('decodescript', [ hex ]);
}

async function sendRawTransaction(signedHex) {
  return await rpc('sendrawtransaction', [ signedHex ]);
}

