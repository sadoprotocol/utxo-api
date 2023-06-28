# API Endpoints

## Table of contents

- [API Endpoints](#api-endpoints)
  - [Table of contents](#table-of-contents)
  - [UTXO](#utxo)
    - [Transaction](#transaction)
    - [Unconfirmed Transaction](#unconfirmed-transaction)
    - [Transactions](#transactions)
    - [Unspents](#unspents)
    - [Balance](#balance)
    - [Fees](#fees)
    - [Relay](#relay)
    - [Mempool summary](#mempool-summary)
    - [Ord Index Status](#ord-index-status)
    - [Inscriptions](#inscriptions)
    - [Inscription Media](#inscription-media)
  - [Wallet](#wallet)
    - [Balances](#balances)
  - [Sado](#sado)

<hr>

## UTXO

### Transaction

Retrieve a transaction information

Endpoint: `/utxo/transaction` `POST`\
Body request:
```js
{
    "txid": "<transaction_id>",
    "options": {
        "noord": false, // Default: false
        "nohex": false, // Default: false
        "nowitness": false // Default: false
    }
}
```
> **noord**: Exclude ordinals information\
> **nohex**: Exclude transaction hex, lower response payload\
> **nowitness**: Exclude vin witness script, lower response payload


</br>

### Unconfirmed Transaction

Check if a transaction is still pending in mempool.

Endpoint: `/utxo/unconfirmed_transaction` `POST`\
Body request:
```js
{
    "txid": "<transaction_id>"
}
```

</br>

### Transactions

Retrieve the transactions of an address via cursor.

Endpoint: `/utxo/transactions` `POST`\
Body request:
```js
{
    "address": "<address>",
    "options": {
        "noord": true, // Default: false
        "nohex": true, // Default: false
        "nowitness": true, // Default: false
        "before": 0, // Default: 0
        "after": 0, // Default: 0
        "limit": 50 // approximate transaction limit (by block), Default: 50
    }
}
```
> **noord**: Exclude ordinals information\
> **nohex**: Exclude transaction hex, lower response payload\
> **nowitness**: Exclude vin witness script, lower response payload\
> **before**: Filters response to only include transactions below before height in the blockchain\
> **after**: Filters response to only include transactions above after height in the blockchain\
> **limit**: Set number of transactions return, it may exceed for cursor block completion

Cursor position depends on the following:

Response from the server will return similar options parameter with suggestion `before` and `after` value to be used for the next cursor call.

If `before` or `after` value is:
- An **integer**, there are more data to obtain.
- **false** you are up-to-date, no more data.

An example to retrieve the entire transactions of an address using the cursor to retrieve the **latest to oldest** transactions:
```js
let transactionUrl = "<uri>/utxo/transactions";
let body = { address: "<address>" };
let cursor = await fetch(transactionsUrl, body);

do {
  if (cursor.success) {
    await do_something(cursor.rdata);

    // follow the response suggestion
    body.options = cursor.options;

    cursor = await fetch(transactionsUrl, body);
  }
}
while(cursor.success && cursor.options.before !== false)
```

To retrieve only the latest transactions from where you've left off previously, replace `before` above with `after`.

</br>

### Unspents

Retrieve the spendable transactions of an address.

Endpoint: `/utxo/unspents` `POST`\
Body request:
```js
{
    "address": "<address>",
    "options": {
        "noord": false, // Default: false
        "notsafetospend": false, // Default: false
        "allowedrarity": ["common", "uncommon"], // Default: ["common", "uncommon"]
        "txhex": false, // Default: false
        "oips": false // Default: false
    }
}
```
> **noord**: Exclude ordinals information\
> **notsafetospend**: Exclude unsafe transaction to spend\
> **allowedrarity**: Define rarity scope of ordinal that are safe to spend\
> **txhex**: Include the hex of transaction (only for "pubkey", "pubkeyhash", "multisig" types)
> **oips**: Display information that supports OIPs

A transaction is considered safe to spend when:
- Has been indexed by Ord
- Has no inscriptions
- Within `allowedrarity` scope

</br>

### Balance

Retrieve the balance of an address.

Endpoint: `/utxo/balance` `POST`\
Body request:
```js
{
    "address": "<address>"
}
```

</br>


### Fees

Retrieve the average block network fee.

Endpoint: `/utxo/fees` `POST`\
Body request:
```js
{
    "old": 5, // Default: 5, blocks behind tip
    "older": 15 // Default 15, blocks behind tip
}
```


</br>


### Relay

Relay a valid signed transaction.

Endpoint: `/utxo/relay` `POST`\
Body request:
```js
{
    "hex": "<signed_transaction_hex>"
}
```

</br>


### Mempool summary

Retrieve brief information about the mempool activity.

Endpoint: `/utxo/mempool_info` `GET`


</br>


### Ord Index Status

Retrieve the status of available indexers.

Endpoint: `/utxo/ord_indexer_status` `GET`

The response returns which has one of the following values:
- An integer that shows the latest block that has been indexed
- A string that stats the activity of the indexer (busy)

The indexer with the highest integer is used by this service to perform ord lookup.

</br>

### Inscriptions

Retrieve the information of an inscription.

Endpoint: `/utxo/inscriptions/<outpoint>` `GET`

> `<outpoint>` is the `<transaction_id>:<vout_n>`

</br>

### Inscription Media

Retrieve the media content of an inscription.\
Can be used directly with html tags for websites.

Endpoint: `/utxo/inscriptions/<outpoint>/<id>/media` `GET`
  
> `<outpoint>` is the `<transaction_id>:<vout_n>`


</br>
</br>

## Wallet

### Balances

Retrieve ordinal aware objects with balances of addresses

Endpoint: `/wallet/balances` `POST`\
Body request:
```js
{
    "addresses": ["<address_one>", "<address_two>", ...]
}
```


</br>
</br>

## Sado

Endpoint: `/sado/[dynamic]` `GET` `POST`

At the moment, this is a redirection to `https://api.sado.space`.\
More information and endpoints available can be found [here (TODO)]().
