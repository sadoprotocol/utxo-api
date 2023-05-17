"use stict";

const Mongo = require('../src/mongodb');

exports.store = store;

async function store(ipAddress, path, params = {}) {
  const db = Mongo.getClient();

  let paramsStrigified = JSON.stringify(params);

  let data = {
    ip: ipAddress,
    path,
    params: paramsStrigified,
    counter: 1
  };

  let checkData = {
    ip: ipAddress,
    path,
    params: paramsStrigified
  }

  let exist = await db.collection("logger").findOne(checkData);

  if (exist) {
    data.counter = exist.counter + 1;
  }

  await db.collection("logger").updateOne(checkData, {
    $set: data
  }, {
    upsert: true
  });
}
