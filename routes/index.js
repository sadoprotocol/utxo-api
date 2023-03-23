const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
  res.json({
    success: false,
    message: 'Invalid request',
    rdata: null
  });
});

module.exports = router;
