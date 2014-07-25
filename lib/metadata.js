/*jshint node: true */

'use strict';

var fs = require('fs');
var RSVP = require('rsvp');
var sqlite = require('sqlite3');

function openDb(dbFileName) {
  return new RSVP.Promise(function(resolve,reject){
    resolve(new sqlite.Database(dbFileName));
  });
}

function tableExists(db, tableName) {
  return new RSVP.Promise(function(resolve, reject) {
   
    db.get(
      "SELECT count(*) as rowCount FROM sqlite_master WHERE type='table' AND name = $tableName",
      {
        $tableName: tableName
      },
      function(err, record) {
        if(err) {
          reject(err); 
        } else {
          resolve(record && record.rowCount > 0);
        } 
      }
    );
  });
}

function createTable(db, tableName, columnDefs) {
  
  return tableExists(db, tableName).then(function(exists) {
     
    return new RSVP.Promise(function(resolve, reject) {
      
      if (exists) {
        return resolve(false);
      }
      db.run('CREATE TABLE ' + tableName + ' (' + columnDefs.join(', ') + ')', function() {
        return resolve(true);
      });
    });
  });
}

function initDb(db) {
  return createTable(db,'log',['path','parent_id','revision_id','created_on','message']);
}

var Metadata = module.exports = function(dbFileName) {
  var self= this;
  this.createdTables = openDb(dbFileName).then(function(db){
    self.db = db;
    return initDb(self.db);
  });
};

Metadata.prototype = {
  _getPath: function(revision) {
    var self = this;
    return this.createdTables.then(function() {
      return new RSVP.Promise(function(resolve, reject) {
        self.db.get(
          'SELECT path FROM log WHERE revision_id = $id',
          {
            $id: revision
          },
          function(err, row) {
            if(err) { 
              reject(err);
            } else {
              resolve(!row?[]:row.path.split(','));
            }
          }
        );
      });
    });
  },
  log: function(parent, current, message) {
    var self = this;
    return this.createdTables.then(function() {
      return new RSVP.Promise(function(resolve, reject) {
        self._getPath(parent).then(function(path){
          self.db.run(
            "INSERT INTO log (path, parent_id, revision_id, created_on, message) VALUES ($path, $parent,$current,$createdOn,$msg)",
            {
              $parent : parent,
              $current: current,
              $createdOn: Date.now(),
              $msg: message,
              $path: path.concat([ parent ]).join(',')
            },
            function(){
              return resolve(true);
            });
        });
      });
    });
  },
  getLog: function(revision) {
    var self = this;
    return this.createdTables.then(function() {
      return new RSVP.Promise(function(resolve, reject) {
        self._getPath(revision).then(function(path){
          path = path.concat([ revision ]);
          var results = [];
          var query = "SELECT revision_id, created_on, message FROM log WHERE revision_id IN (" + path.join(", ") + ")";
          self.db.each(
            query,
            function(err, row) {
              if (err) {
                throw err;
              }
              results.push({
                rid: row.revision_id,
                createdOn: new Date(parseInt(row.created_on)),
                message: row.message
              });
            },
            function(){
              resolve(results);
            });
        });
      });
    });
  }
};