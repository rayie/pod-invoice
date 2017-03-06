var express = require('express');
var router = express.Router();
const _ = require("lodash");
var Promise = require("bluebird");
var read = Promise.promisify( require("fs").readFile );

var toUSD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
});


function procInvoice(lines){
	var hdr = lines[0];
  hdr.tax = "0.00";

	hdr.subtotal = lines.reduce(function(t,r){ return t+r.amount; },0)
  hdr.subtotal = toUSD.format(hdr.subtotal);
	hdr.lines = lines.map(function(r){
    r.amount *= 100;
    r.amount = toUSD.format(r.amount).replace(/\$/,"");
    r.sales_price = toUSD.format(r.sales_price).replace(/\$/,"");
    return r;
  });
	//console.log('hdr',hdr);
	return hdr;
}

function absorb(req){
  return req.db.aggregate([
      { $group: {_id: "$num", n:{$sum:1}} }
  ]).toArray()
  .then(function(rr){
    r = rr.filter( function(r){ return r.n>7; }).pop();
    return req.db.find({num: r._id},{sort: {source_file_idx:1}}).toArray()
		.then(procInvoice)
    .catch(function(err){ throw err; })
  });
}


function byNum(req,num){
	return req.db.find({num: num},{sort: {source_file_idx:1}})
	.toArray()
	.then(procInvoice)
  .catch(function(err){ throw err; })
}


/* GET home page. */
router.get('/fonts', function(req, res, next) {
  console.log("got to /fonts route");
  return absorb(req)
  .then(function(inv){
    //console.log(inv);
    res.render('fonts');
  })
  .catch(function(err){
    console.log(err);
  })
});

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log("got to / route");
  return absorb(req)
  .then(function(inv){
    //console.log(inv);
    res.render('index', inv);
  })
  .catch(function(err){
    console.log(err);
  })
});


/* GET home page. */
router.get('/inv/:num', function(req, res, next) {
  console.log("got to /inv:num route");
  return byNum(req,req.params.num)
  .then(function(inv){
    res.render('index', inv);
  })
  .catch(function(err){
    console.log(err);
  })
});


module.exports = router;
