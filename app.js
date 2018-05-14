var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');

const MongoDB = require("mongodb");
const MC = MongoDB.MongoClient;
const _ = require('lodash');

var F = function(){
  this.init = function(){
    var self = this;
    var dburl = process.env.WINWIN_CONN;
    console.log(dburl);
    var ccdb_at = dburl.split(/@/).pop();
    console.log("attempting connection to " + ccdb_at);
		return MC.connect(dburl)
		.then(function(dbconn){
      app.dbconn = dbconn; 
      return;
    })
    .catch(function(err){
      console.log(err);
    }); 
  };
  this.mw = function(req,res,next){
    req.db = app.dbconn.collection("winwin_inv");;
    console.log('attached db to req');
    return next();
  }
}

var app = express();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
var f = new F();
f.init();
app.use(f.mw);
app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
