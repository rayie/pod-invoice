var express = require('express');
var router = express.Router();
const _ = require("lodash");
var Promise = require("bluebird");
var read = Promise.promisify( require("fs").readFile );

function absorb(req){
  return req.db.aggregate([
      { $group: {_id: "$num", n:{$sum:1}} }
  ]).toArray()
  .then(function(rr){
    r = rr.filter( function(r){ return r.n>7; }).pop();

    return req.db.find({num: r._id},{sort: {source_file_idx:1}}).toArray()
    .then(function(lines){
      var hdr = lines[0];
      hdr.subtotal = lines.reduce(function(t,r){ return t+r.amount; },0)
      hdr.lines = lines;
      console.log('hdr',hdr);
      return hdr;
    })
    .catch(function(err){ throw err; })
  });
}

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log("got to / route");
  return absorb(req)
  .then(function(inv){
    console.log(inv);
    res.render('index', inv);
  })
  .catch(function(err){
    console.log(err);
  })
});

module.exports = router;
