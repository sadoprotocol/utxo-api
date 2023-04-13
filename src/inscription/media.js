"use strict";

const Mongo = require('../../src/mongodb');
const utxo = require('../../src/utxo');

exports.prepare = prepare;
exports.get = get;


async function prepare() {
  const db = Mongo.getClient();

  // Create collection and indexes
  let collections = await db.listCollections().toArray();
  let createCollections = [ 'inscription_media' ];
  let createCollectionsIndex = {
    "inscription_media": [
      {
        "outpoint": 1,
        "inscription_id": 1
      }
    ]
  };

  for (let i = 0; i < collections.length; i++) {
    if (collections[i].type === 'collection') {
      let index = createCollections.indexOf(collections[i].name);

      if (index > -1) {
        createCollections.splice(index, 1);
      }
    }
  }

  for (let i = 0; i < createCollections.length; i++) {
    let name = createCollections[i];

    await db.createCollection(name);

    console.log('Created new collection' + name + '.');

    if (createCollectionsIndex[name]) {
      // Create the indexes
      for (let m = 0; m < createCollectionsIndex[name].length; m++) {
        await db.collection(name).createIndex(createCollectionsIndex[name][m]);
        console.log('Collection ' + name + ' is indexed [' + m + '].');
      }
    }
  }
}

async function get(outpoint, inscription_id) {
  const db = Mongo.getClient();

  let foundOne = await db.collection("inscription_media").findOne({
    "outpoint": outpoint,
    "inscription_id": inscription_id
  });

  if (foundOne !== null) {
    return {
      "media_content": foundOne.media_content,
      "media_type": foundOne.media_type
    }
  }

  let inscriptions = await utxo.inscriptions(outpoint);
  let inscriptionIndex = inscriptions.findIndex(item => {
    return item.id === inscription_id;
  });

  if (inscriptionIndex === -1) {
    throw new Error("Inscription ID not found.");
  }

  await db.collection("inscription_media").insertOne({
    "outpoint": outpoint,
    "inscription_id": inscription_id,
    "media_content": inscriptions[inscriptionIndex].media_content,
    "media_type": inscriptions[inscriptionIndex].media_type
  });

  return {
    "media_content": inscriptions[inscriptionIndex].media_content,
    "media_type": inscriptions[inscriptionIndex].media_type
  }
}
