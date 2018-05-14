const Promise = require("bluebird");
const needle = require('needle');
const fs = require('fs');
const read = Promise.promisify(require("fs").readFile);
const write = Promise.promisify(require("fs").writeFile);
const MongoDB = require("mongodb");
const MC = MongoDB.MongoClient;
const _ = require('lodash');
const u2p = require('url2pdf');
const gsheets = require('./googlesheets.js');

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

  this.findMissingPods =function(){
    var p = [
      {$group: {_id: "$num"}},
      {$sort:{_id:1}}
    ]
    return self.dbconn.collection("winwin_inv").aggregate(p).toArray()
    .then(function(rr){
      var all_inv_nums = rr.map(function(r){
        //console.log(r._id);
        return parseInt(r._id,10);
      })
      all_inv_nums.sort();
      console.log("all invs",all_inv_nums.length);
      return self.invsDone(function(done){
        console.log("invs done:",done.length);
        var missing = _.difference(all_inv_nums,done)
        console.log("missing", missing.length);
        missing.forEach(function(m){
          console.log(m);
        });
      })
    })
  }

  this.invsDone=function(cb){
    fs.readdir("./data/done",function(err,data){
      console.log(err);
      var lines = data;
      lines.pop();
      lines = lines.reverse().map(function(line){
        return parseInt(line.split(/-/g)[0],10);
      })
      return cb(lines);
    })
  }

  this.invToDb= function(dbconn){
    gsheets.loadInvs()
    .then(function(rows){
      //var rows = raw.toString().split(/\n/g);
      var lines = rows.splice(1);
      var colnames = rows[0];
      var colRef = _.zipObject( colnames.map(function(r){ 
				console.log(r);
				return r.toLowerCase().trim().replace(/ |\/|#/g,"_").replace(/_*$|\r/g,""); })
        , _.range( 0, colnames.length )  );
      delete colRef["p._o."];
      delete colRef[""];
      console.log(colRef);
			//process.exit();

      lines = lines.filter(function(r){ 
        if ( r.length===0) return false;  
        console.log(r);
        return (r[ colRef.type ].trim()=="Invoice");
      })
      .map(function(r,idx){
        var lineObject = {};
        for(var k in colRef)
          lineObject[ k ] =  r[colRef[k]];
        lineObject['sourc_file_idx']=idx;
        lineObject.qty = parseFloat( lineObject.qty,10);
        lineObject.sales_price = parseFloat( lineObject.sales_price,10);
        console.log(lineObject.amount);
        lineObject.amount = parseFloat( lineObject.amount.replace(/[^0-9\.-]/g,"") ,10);
        console.log(lineObject.amount);
        lineObject.balance = parseFloat( lineObject.balance ,10);

        return lineObject;
      })
      return self.dbconn.collection("winwin_inv").insertMany(lines)
    })
    .then(function(insertResult){
      //console.log(insertResult);

      //now check the total amount inserted
      var pipe= [
        { 
          $group: { 
            _id:"$type", total: {$sum: "$amount" }
          }
        }
      ];
      
      return self.dbconn.collection("winwin_inv").aggregate(pipe).toArray();
    })
    .then(function(rr){
      console.log("TOTAL: $" , rr[0].total);
      self.all_invs_to_pdf();
    })
    .catch(function(err){ 
      console.log(err); 
      process.exit("Failed converting invoice lines from google sheets to winwin db")
    });
  };

  this.all_invs_to_pdf = function(){
    self.dbconn.collection("winwin_inv").aggregate([
        { $match: { rendered: {$ne: true}  } },
        { $group: {_id: "$num", n:{$sum:1}} },
        { $sort: {"_id":1} }
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

  this.tsv_to_db = function(dbconn){
    read("/Volumes/DataDrive/yung-invoice/data/sample_invoice_file.tsv")
    .then(function(raw){
      var rows = raw.toString().split(/\n/g);
      var lines = rows.splice(1);
      var colnames = rows[0];
      var colRef = _.zipObject( colnames.split(/\t/g).map(function(r){ return r.toLowerCase().trim().replace(/ |\/|#/g,"_").replace(/_*$|\r/g,""); })
        , _.range( 0, colnames.length )  );
      //colRef["poNumber"] = colRef["p._o."] *1;
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

      return self.dbconn.collection("winwin_inv").insertMany(lines)
    })
    .then(function(insertResult){
      //console.log(insertResult);
    })
    .catch(function(err){ console.log(err); })
  }


  this._to_pdf= function(num,rr){
    var url = "http://localhost:3001/inv/" + num;
    console.log(url);
    console.log("Saving to " + num+"_inv.pdf");
    u2p.renderPdf( url, {
      fileName: num + "_inv.pdf",
      saveDir: "/var/www/pod-invoice/data/generatedinvs"
      //saveDir: "/var/www/pod-invoice/public/invs"
    })
    .then(function(path){
      console.log(path);
      return self.dbconn.collection("winwin_inv")
      .updateMany(
        { num: num  },
        {$set: { rendered:true} }
      )
    })
    .then(function(updateResult){
      console.log(updateResult.result);
      return self._iterate_invs(rr);
    })
    .catch(function(err){ console.log(err); })

  }

  this.fonts_to_pdf = function(num,rr){
    var url = "http://localhost:3001/fonts";
    u2p.renderPdf( url, {
      fileName: "fontsamples.pdf",
      saveDir: "/var/www/pod-invoice/data/generatedinv"
      //saveDir: "/var/www/pod-invoice/public/invs"
    })
    .then(function(path){
      process.exit(); 
    })
  },

  this.sample_to_pdf= function(){
    var url = "http://winwinproducts.com/all/pod_1Z44V1400352015776.htm";
    url = "http://localhost:3001";
    u2p.renderPdf( url, {
      fileName:"sampleOut"+Math.random().toString(), 
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



