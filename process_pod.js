//var htop = require("html-pdf");
var fs = require('fs');
var needle = require('needle');
var u2p = require('url2pdf');
var _ = require('lodash');

var sheetNumbers = [];
var mismatchSheet = [];
var mismatchContent = [];
var mismatchFile = [];
var GS = require("./googlesheets.js");

var PODS = function(){
  var self = this;
  this.procLine = function(lines){
    if ( lines.length===0 ) {
      return analyze();
    }
    var line = lines.pop();
    //console.log(line);
    if ( typeof line === "string" ){
      var parts = line.split(/ /);
      var url = parts[1].trim();
      var invNum = parts[0].trim();
    }
    else{
      var url = line[1].trim();
      var invNum = line[0].trim();
    }

    console.log(url, invNum);
    needle.get(url, function(err, res){
      if (err){
        console.log("error fetching pod :", invNum, err);
        var fn = invNum;
        return procLine(lines);
      }
      //console.log(res.body.toString());
      var html = res.body.toString()
      sheetNumbers.push(invNum);

      var ob = html.match(/INV#[0-9]*,/g);
      if ( ob===null ){
        console.log("No invoice num in html:", invNum);
        var fn = invNum+".pdf";
        return u2p.renderPdf(url,{filename: fn, saveDir:"./data/matches"})
        .then(function(path){ 
          console.log(path);
          return procLine(lines);
        });
      
      }

      //console.log(ob);
      var invs = [];
      ob.forEach(function(p){
        //console.log(p);//.input.substr(1142,10));
        invs.push( p.replace(/,/g,"") );
      });
      invs = _.uniq(invs);
      if ( invs.length > 1 ) { 
        console.log("\n****WARN - multiple numbers referenced***", invs);

      }
      if (invs[0] !== "INV#"+invNum){
        console.log("Mismatch: " + invNum + " vs: " + invs[0]);
        mismatchSheet.push( invNum );
        mismatchContent.push( invs[0].substr(4) );
        mismatchFile.push( [ invNum, invs[0].substr(4) ].join(",") );
        var fn = "Actual-"+invs.join(",").replace(/INV#/g,"") + "-vs-Sheet-"+invNum+".pdf";
      }
      else {
        console.log("MATCH: " + invNum + " === " + invs[0]);
        var fn = invNum+".pdf";
      }
     
      return u2p.renderPdf(url,{filename: fn, saveDir:"./data/matches"})
      .then(function(path){ 
        console.log(path);
        return setTimeout( function() { self.procLine(lines); }, 3000 );
      });

    });
  },
  this.analyze = function(){
    fs.writeFile("./data/mismatches.xls",mismatchFile.join("\n"),function(err){
      if ( err) { console.error("Failed writing mismatch file"); }
      else console.log('wrote mismatch file');
    });
  },
  this.loadFromGoogleSheets = function(){
    return GS.loadFromGoogleSheets()
    .then(function(gsheetRows){
      console.log("Got gsheetRows");
      console.log(gsheetRows);
      return self.procLine( 
        gsheetRows.map(function(r){ 
          return [ r[0], ["http://winwinproducts.com/all/pod_",r[1],".htm"].join("") ]; 
        })
      );
    })
    .catch(function(err){
      console.error(err);
      process.exit();
    });
  }

  this.loadInvToPODLInkFromFile = function(){
    fs.readFile("./data/ref.txt",function(err,data){
      //console.log(err,data.toString());
      var lines = data.toString().split(/\n/g);
      lines.pop();
      lines.reverse();
      if ( process.argv.length === 3 ){
        var startAt = process.argv[2]
        lines.forEach(function(line,idx){
          console.log(line);
          if (line.split(" ")[0]===startAt){
            console.log("Marked " + startAt + " at index:" + idx);
            mark = idx;
          }
        });
        console.log("mark:",mark);
        lines.splice(mark+3);
      }
      /*
      console.log(lines.length + " lines");
      console.log(lines[ lines.length-1 ]);
      console.log(lines[ lines.length-2 ]);
      lines = ["http://winwinproducts.com/all/pod_1Z44V1400352950854.htm 74814"];
      */
      self.procLine(lines);
    })
  }
}

var p = new PODS();
p.loadFromGoogleSheets();
