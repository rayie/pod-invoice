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
var hummus = require('hummus');

var PODS = function(){
  var self = this;
	this.done_inv_nums = [];
  this.procLine = function(lines){
    if ( lines.length===0 ) {
      return self.analyze();
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
		//if using cutoff after failed http to winwin, uncomment following, apply invnum cutoff
		if ( invNum > 109801 ) return self.procLine(lines);

    needle.get(url, function(err, res){
      if (err){
        console.log("error fetching pod :", invNum, err);
        var fn = invNum;
        return self.procLine(lines);
      }
      //console.log(res.body.toString());
      var html = res.body.toString()
      sheetNumbers.push(invNum);

      var ob = html.match(/INV#[0-9]*,/g);

      if ( ob===null ){
        console.log("No invoice num in html:", invNum);
        var fn = invNum+".pdf";
      }
			else{

				//console.log(ob);
				var invsReferencedByPod = [];
				ob.forEach(function(p){
					//console.log(p);//.input.substr(1142,10));
					invsReferencedByPod.push( p.replace(/,/g,"").replace(/INV#/i,"") );
				});

				invsReferencedByPod = _.uniq(invsReferencedByPod);

				var extraInvNums = invsReferencedByPod.filter(function(n){
					return n!==invNum && self.done_inv_nums.indexOf( n )==-1;
				})

				//console.log("extraInvNums", extraInvNums);
				var thisInvNum = invsReferencedByPod.filter(function(n){
					return n===invNum;
				})

				//push the extra invs referenced onto the stack with the same pod url
				for(var i=0; i<extraInvNums.length; i++){
					console.log("\n****WARN - multiple numbers referenced***", extraInvNums[i]);
					lines.push([extraInvNums[i],url]);
				}

				if (thisInvNum.length===0){
					console.log("\n***WARN - INV stated in pod mapping file doesn't match any invs stated in the POD html data: " + invNum );
					process.exit();
				}
				else{
					console.log("MATCH: " + invNum + " === " + thisInvNum[0]);
				}
				var fn = invNum+".pdf";
			}
     
      return u2p.renderPdf(url,{fileName: fn, saveDir:"./data/downloadedpods"})
      .then(function(pathToPOD){ 

				try {
					var pathToInv = "./data/generatedinvs/"+invNum+"_inv.pdf";
					fs.accessSync(pathToInv); //throws if not found
					//console.log(invNum,pathToInv,pathToPOD);
				}
				catch(err){
					console.log("invoice not found", invNum, err);
					throw err;
				}

				return self.merge(invNum,pathToInv,pathToPOD)
			})
			.delay(2000)
			.then(function(){
				return self.procLine(lines);
			})
			.catch(function(err){
				console.log("Got bottom level catch", err);	
				return self.procLine(lines);
			});

    });
  },

	this.merge = function(num, pathToInv, pathToPOD){
		return new Promise(function(resolve,reject){
			var name = num+"-with-pod.pdf";
			var P = hummus.createWriter("./data/done/"+name);

			console.log("merging ", pathToInv, pathToPOD);

			var page1 = P.createPage(0,0,595,842);
			var page2 = P.createPage(0,0,595,842);

			P.mergePDFPagesToPage(page1,pathToInv);
			P.mergePDFPagesToPage(page2,pathToPOD);
			P.writePage(page1).writePage(page2).end();

			self.done_inv_nums.push(num);

			return fs.unlink(pathToPOD,function(err){
				console.log(err);
				return resolve();
			});
		});
	}


  this.analyze = function(){
    fs.writeFile("./data/mismatches.xls",mismatchFile.join("\n"),function(err){
      if ( err) { console.error("Failed writing mismatch file"); }
      else console.log('wrote mismatch file');
    });
  },

  this.loadFromGoogleSheets = function(){
    return GS.loadPods()
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
