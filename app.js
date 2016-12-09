var htop = require("html-pdf");
var fs = require('fs');
var needle = require('needle');
var u2p = require('url2pdf');
var _ = require('lodash');

var sheetNumbers = [];
var mismatchSheet = [];
var mismatchContent = [];
var mismatchFile = [];

var procLine = function(lines){
  if ( lines.length===0 ) {
    return analyze();
  }
  var line = lines.pop();
  //console.log(line);
  var parts = line.split(/ /);
  var url = parts[0].trim();
  var invNum = parts[1].trim();
  //console.log(url, invNum);
  needle.get(url, function(err, res){
    //console.log(res.body.toString());
    var html = res.body.toString()
    sheetNumbers.push(invNum);

    var ob = html.match(/INV#[0-9]*,/g);
    if ( ob===null ){
      console.log("No invoice num in html:", invNum);
      var fn = invNum;
      return u2p.renderPdf(url,{id: fn, saveDir:"./matches"})
      .then(function(path){ 
        console.log(path);
        return procLine(lines);
      });
    
      /*
      return htop.create( html ).toFile("./notInHTML/"+invNum+".pdf", function(err,fileRes){
        console.log(fileRes);
        return procLine(lines);
      });
      */
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
      var fn = "Actual-"+invs.join(",").replace(/INV#/g,"") + "-vs-Sheet-"+invNum;
    }
    else {
      console.log("MATCH: " + invNum + " === " + invs[0]);
      var fn = invNum;
    }

    return u2p.renderPdf(url,{id: fn, saveDir:"./matches"})
    .then(function(path){ 
      console.log(path);
      return procLine(lines);
    });
    
    /*
    return htop.create( html ).toFile("./mismatched/"+invNum+"-"+invs[0].substr(4)+".pdf", function(err,fileRes){
      console.log(err);
      console.log(fileRes);
      return procLine(lines);
    });
    */

  });
};
var analyze = function(){
  fs.writeFile("./mismatches.xls",mismatchFile.join("\n"),function(err){
    if ( err) { console.error("Failed writing mismatch file"); }
    else console.log('wrote mismatch file');
  });
}

fs.readFile("./data.xls",function(err,data){
  //console.log(err,data.toString());
  var lines = data.toString().split(/\n/g);

  lines.pop();
  lines.reverse();
  lines.forEach(function(line,idx){
    if (line.split(" ").pop()==="64757"){
      mark = idx;
    }
  });
  console.log("mark:",mark);
  lines.splice(mark+10);
  /*
  console.log(lines.length + " lines");
  console.log(lines[ lines.length-1 ]);
  console.log(lines[ lines.length-2 ]);
  */
  lines = ["http://winwinproducts.com/all/pod_1Z44V1400352950854.htm 74814"];
  procLine(lines);
});
