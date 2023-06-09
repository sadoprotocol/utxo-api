"use strict"

const Redis = require('redis');
const redisDeletePattern = require('redis-delete-pattern');

const redisClient = Redis.createClient();
redisClient.connect().then(() => console.log('Redis client connected')).catch(console.log);

exports.set = set;
exports.get = get;
exports.delete = deletePattern;


function set(params) {
  let expiration = params.expiration || false;
  let key = params.key || false;
  let data = params.data || false;

  if (!key || !data) {
    throw new Error("Expecting key and data.");
  }

  if (typeof data !== 'string') {
    data = JSON.stringify(data);
  }

  if (expiration) {
    redisClient.setEx(key, expiration, data);
  } else {
    redisClient.set(key, data);
  }
}

function get(params) {
  return new Promise((resolve, reject) => {
    let key = params.key || false;

    if (!key) {
      reject(new Error('Expecting key.'));
    } else {
      redisClient.get(key).then(data => {
        if (data !== null) {
          try {
            resolve(JSON.parse(data));
          } catch(err) {
            resolve(data);
          }
        } else {
          resolve(false);
        }
      }).catch(reject);
    }
  });
}

// example 'model-*'
function deletePattern(params) {
  return new Promise((resolve, reject) => {
    let pattern = params.pattern || false;

    if (!pattern) {
      reject(new Error('Expecting pattern.'));
    } else {
      redisDeletePattern({
        redis: Redis,
        pattern: pattern
      }, function handleError (err) {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    }
  })
}
