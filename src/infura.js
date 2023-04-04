"use strict";

const gateway = process.env.INFURAGATEWAY;


exports.get = get;


function get(cid) {
  return new Promise(resolve => {
    fetch (gateway + '/ipfs/' + cid, {
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
