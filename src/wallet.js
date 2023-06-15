"use strict"

const lookup = require("../src/lookup");

exports.balances = balances;

async function balances(params) {
  if (!params.addresses && !params.pubkey) {
    throw new Error("Expecting address array or pubkey.");
  }

  if (params.addresses) {
    return await addressBalances(params.addresses);
  } else {
    return await pubkeyBalances(params.pubkey);
  }
}

// ==

async function addressBalances(addresses) {
  if (!Array.isArray(addresses)) {
    throw new Error("Address is not an array");
  }

  let build = [];

  for (let i = 0; i < addresses.length; i++) {
    build.push({
      address: addresses[i]
    });
  }

  let wallet = {
    addresses: build,
    counts: {
      addresses: addresses.length,
      unspents: 0,
      satoshis: 0,
      cardinals: 0,
      spendables: 0,
      unspendables: 0,
      ordinals: 0,
      inscriptions: 0
    }
  };

  let ordinals = [];
  let inscriptions = [];
  let spendables = [];
  let unspendables = [];

  let promises = [];

  for (let i = 0; i < wallet.counts.addresses; i++) {
    promises.push(lookup.unspents(wallet.counts.addresses[i], {
      txhex: true,
      notsafetospend: false,
      allowedrarity: ['common']
    }));
  }

  let resolved = await Promise.all(promises);

  for (let i = 0; i < wallet.counts.addresses; i++) {
    let address = wallet.addresses[i].address;
    let wallet_unspents = 0;
    let wallet_satoshis = 0;
    let wallet_cardinals = 0;
    let wallet_spendables = 0;
    let wallet_unspendables = 0;

    wallet.addresses[i].unspents = resolved[i];

    let unspents_length = wallet.addresses[i].unspents.length;

    wallet.counts.unspents += unspents_length;
    wallet_unspents += unspents_length;

    for(let u = 0; u < wallet.addresses[i].unspents.length; u++) {
      let un = wallet.addresses[i].unspents[u];

      wallet.counts.satoshis += un.sats;
      wallet_satoshis += un.sats;

      if (un.safeToSpend) {
        wallet.counts.cardinals += un.sats;
        wallet_cardinals += un.sats;
        wallet.counts.spendables++;
        wallet_spendables++;
        spendables.push(un);
      } else {
        wallet.counts.unspendables++;
        wallet_unspendables++;
        unspendables.push(un);
      }

      let ord = un.ordinals;
      let ins = un.inscriptions;

      for (let od = 0; od < ord.length; od++) {
        ord[od].address = address;
        ord[od].unspent = un.txid;
        ordinals.push(ord[od]);
      }

      for (let is = 0; is < ins.length; is++) {
        ins[is].address = address;
        ins[is].unspent = un.txid;
        inscriptions.push(ins[is]);
      }
    }

    wallet.addresses[i].counts = {
      unspents: wallet_unspents,
      satoshis: wallet_satoshis,
      cardinals: wallet_cardinals,
      spendables: wallet_spendables,
      unspendables: wallet_unspendables
    };
  }

  wallet.spendables = spendables;
  wallet.unspendables = unspendables;
  wallet.ordinals = ordinals;
  wallet.inscriptions = inscriptions;
  wallet.counts.ordinals = ordinals.length;
  wallet.counts.inscriptions = inscriptions.length;

  return wallet;
}

async function pubkeyBalances(pubkey) {
  let result = [];

  return result;
}
