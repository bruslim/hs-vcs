var RSVP = require('rsvp');
var Metadata = require('../lib/metadata');

var m = new Metadata(':memory:');

m.log(0,1,"Test1").then(function(){
  return m.log(1,2,"Test2");
}).then(function(){
  return m.log(2,3,"Test3")
}).then(function() {
  m.getLog(1).then(function(log){
    console.log('= = = 1 = = =');
    console.log(log);
  });
  m.getLog(2).then(function(log){
  console.log('= = = 2 = = =');
    console.log(log);
  });
  m.getLog(3).then(function(log){
  console.log('= = = 3 = = =');
    console.log(log);
  });
});


