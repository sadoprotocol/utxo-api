"use strict";

const express = require('express');
const router = express.Router();

const inscription = require('../src/inscription');

router.all('/:id', function(req, res, next) {
  inscription.media.get(
    inscription.utils.getOutpointFromId(req.params.id), 
    req.params.id
  ).then(data => {
    let buff = Buffer.from(data.media_content, 'base64');

    res.writeHead(200, {
      'Content-Type': data.media_type,
      'Content-Length': buff.length
    });

    res.removeHeader('X-Frame-Options');

    res.end(buff);
  }).catch(next);
});

module.exports = router;
