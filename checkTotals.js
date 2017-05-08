const PDFParser = require("pdf2json");
var fs = require('fs');
var _ = require('lodash');
var files = [];


var total = 0;
function f(){
	if (files.length==0){ 
		process.exit(); 
	}
	var file = files.pop();
	var pdfParser = new PDFParser();
	pdfParser.on("pdfParser_dataError", function(errData){
		console.log("err",errData);
	});

	pdfParser.on("pdfParser_dataReady", function(pdfData){
		var tmp =  pdfParser.getRawTextContent();
		var txt = pdfData.formImage.Pages[0].Texts.map(function(T){
			//console.log(T.R);
			return T.R.map(function(txt){
				return txt.T[0];
			}).join("");
		}).join("");
		
		//console.log("\n\n",txt);	
		txt = txt.split(/TOTALDUE/).pop();
		var startOfNote = txt.search(/NOTE/);

		var tot = parseFloat( txt.substr(0,startOfNote).replace(/%/,""), 10 );

		//txt = txt.split(/TOTALDUE/).pop();
		total+=tot;
		console.log("\n"+file,tot, total);
		delete pdfParser;
		f();
	});

	pdfParser.loadPDF("./data/done/"+file);

};

fs.readdir("./data/done",function(err,list){
  files = [].concat(list);
  console.log(files);
  return f();
});

