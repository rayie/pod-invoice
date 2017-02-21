const Promise = require("bluebird");
const needle = require('needle');
const read = Promise.promisify(require("fs").readFile);
const write = Promise.promisify(require("fs").writeFile);
const MongoDB = require("mongodb");
const MC = MongoDB.MongoClient;
const _ = require('lodash');
const u2p = require('url2pdf');

var F = function(){
  this.init = function(fn){
    var self = this;
    var dburl = process.env.WINWIN_CONN;
    console.log(dburl);
    var ccdb_at = dburl.split(/@/).pop();
    console.log("attempting connection to " + ccdb_at);
		return MC.connect(dburl)
		.then(function(dbconn){
      
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
      console.log(colRef);

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
      console.log(insertResult);
    })
    .catch(function(err){ console.log(err); })
  }

  this.to_pdf= function(){
    var url = "http://winwinproducts.com/all/pod_1Z44V1400352015776.htm";

    url = "http://localhost:3000";
    u2p.renderPdf( url, {
      id:"sampleOut"+Math.random().toString(), 
      saveDir: "/var/www/yung-invoice/data",
    })
    .then(function(path){
      console.log(path);
      process.exit();
    })
    .catch(function(err){ console.log(err); })

  }
}
var fn= process.argv[2];
var f = new F();
f.init(fn);



