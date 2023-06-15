"use strict";

const express = require('express');
const router = express.Router();
const wallet = require('../src/wallet');


router.all('/balances', function(req, res, next) {
  wallet.balances(req.body).then(balances => {
    res.json({
      success: true,
      message: 'Balances are',
      rdata: balances
    });
  }).catch(next);
});


module.exports = router;
