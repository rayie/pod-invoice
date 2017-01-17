var htop = require("html-pdf");
var fs = require('fs');
var needle = require('needle');
var u2p = require('url2pdf');
var _ = require('lodash');
var hummus = require('hummus');

function m(num, pathToInv, pathToPOD){
  return new Promise(function(resolve,reject){
    var name = num+"-with-pod.pdf";
    var P = hummus.createWriter("./data/done/"+name);

    console.log("merging ", pathToInv, pathToPOD);

    var page1 = P.createPage(0,0,595,842);
    var page2 = P.createPage(0,0,595,842);

    P.mergePDFPagesToPage(page1,pathToInv);
    P.mergePDFPagesToPage(page2,pathToPOD);
    P.writePage(page1).writePage(page2).end();

    return fs.rename(pathToPOD,"./data/podsDone/"+num,function(err){

      console.log(err);
      return resolve();
    });
  });
}

function f(list){

  if (list.length===0) return;

  var n = list.pop();
  var num = n.split(".")[0];

  try {
    var pathToInv = "./data/invpdfs/"+n;
    var pathToPOD = "./data/matches/"+n;
    var a = fs.accessSync(pathToInv);
    console.log(a);
    console.log(num,pathToInv,pathToPOD);
  }
  catch(err){
    console.log(err);
    return fs.rename(pathToPOD,"./data/missingInv/"+n,function(err){
      console.log(err);
      return f(list);
    });
  }

  return m(num,pathToInv,pathToPOD)
  .then(function(){
    console.log(" done: ", num,pathToInv,pathToPOD)
    return f(list);
  });
}


fs.readdir("./data/matches",function(err,list){
  list.reverse();
  console.log(list);
  f(list);

});
