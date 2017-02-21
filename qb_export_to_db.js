const Promise = require("bluebird");
const needle = require('needle');
const read = Promise.promisify(require("fs").readFile);
const write = Promise.promisify(require("fs").writeFile);
const MongoDB = require("mongodb");
const MC = MongoDB.MongoClient;
const _ = require('lodash');
const u2p = require('url2pdf');

var F = function(){
	var self = this;
	this.dbconn = null;
  this.init = function(fn){
    var dburl = process.env.WINWIN_CONN;
    console.log(dburl);
    var ccdb_at = dburl.split(/@/).pop();
    console.log("attempting connection to " + ccdb_at);
		return MC.connect(dburl)
		.then(function(dbconn){
     	self.dbconn=dbconn; 
      self[fn](dbconn); 
    })
    .catch(function(err){
      console.log(err);
    }); 
  };

  this.rules = function(dbconn){
    read("/Volumes/DataDrive/yung-invoice/data/sample_invoice_file.tsv")
    .then(function(raw){
      var rows = raw.toString().split(/\n/g);
      var lines = rows.splice(1);
      var colnames = rows[0];
      var colRef = _.zipObject( colnames.split(/\t/g).map(function(r){ return r.toLowerCase().trim().replace(/ |\/|#/g,"_").replace(/_*$|\r/g,""); })
        , _.range( 0, colnames.length )  );
      colRef["poNumber"] = colRef["p._o."] *1;
      delete colRef["p._o."];
      delete colRef[""];
      //console.log(colRef);

      lines = lines.map(function(r){
        return r.split(/\t/g);
      }).filter(function(r){ 
        return (r[ colRef.type ].trim()=="Invoice") 
      })
      .map(function(r,idx){
        var lineObject = {};
        for(var k in colRef)
          lineObject[ k ] =  r[colRef[k]];
        lineObject['sourc_file_idx']=idx;

        lineObject.qty = parseFloat( lineObject.qty,10);
        lineObject.sales_price = parseFloat( lineObject.sales_price,10);
        lineObject.amount = parseFloat( lineObject.amount ,10);
        lineObject.balance = parseFloat( lineObject.balance ,10);

        return lineObject;
      })

      return dbconn.collection("winwin_inv").insertMany(lines)
    })
    .then(function(insertResult){
      //console.log(insertResult);
    })
    .catch(function(err){ console.log(err); })
  }

  this.all_invs_to_pdf = function(dbconn){

		dbconn.collection("winwin_inv").aggregate([
				{ $match: { rendered: {$ne: true}  } },
				{ $group: {_id: "$num", n:{$sum:1}} }
		]).toArray()
		.then(self._iterate_invs)
    .catch(function(err){ console.log(err); })
  }

	this._iterate_invs = function(rr){
		if ( rr.length === 0 ) return process.exit();
		var r = rr.pop();
		console.log(r);
		return self._to_pdf( r._id ,rr);
	},

  this._to_pdf= function(num,rr){
    var url = "http://localhost:3000/inv/" + num;
		console.log(url);
    u2p.renderPdf( url, {
      id: num+"_inv",
      //saveDir: "/var/www/pod-invoice/data/generatedinv"
      saveDir: "/var/www/pod-invoice/public/invs"
    })
    .then(function(path){
      //console.log(path);
			return self.dbconn.collection("winwin_inv").updateOne({
			},{$set: { rendered:true} })
    })
		.then(function(updateResult){
			console.log(updateResult.result);
			return self._iterate_invs(rr);
		})
    .catch(function(err){ console.log(err); })

  }


  this.sample_to_pdf= function(){
    var url = "http://winwinproducts.com/all/pod_1Z44V1400352015776.htm";
    url = "http://localhost:3000";
    u2p.renderPdf( url, {
      id:"sampleOut"+Math.random().toString(), 
      saveDir: "/var/www/pod-invoice/data/generatedinv",
    })
    .then(function(path){
      //console.log(path);
      process.exit();
    })
    .catch(function(err){ console.log(err); })

  }
}
var fn= process.argv[2];
var f = new F();
f.init(fn);



