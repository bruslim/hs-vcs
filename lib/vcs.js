/*jshint node: true */

'use strict';

var VCS_DIRECTORY = '.myvcs';
var CMD_DIRECTORY = process.cwd();

var fs = require('fs');
var path = require('path');
var ncp = require('ncp');
var RSVP = require('rsvp');

var Metadata = require('./metadata');

var meta = (function init(){
  var vcsDirectory = getFullPath(CMD_DIRECTORY, VCS_DIRECTORY);
  if (!fs.existsSync(vcsDirectory)) {
    fs.mkdirSync(vcsDirectory);
  }
  return new Metadata(path.join(vcsDirectory,'logs.db'));
})();

function writeHead(revision) {
  fs.writeFileSync(path.join(CMD_DIRECTORY,VCS_DIRECTORY,'HEAD'),revision.toString());
}

function getHead() {
  var filePath = path.join(CMD_DIRECTORY,VCS_DIRECTORY,'HEAD');
  if (!fs.existsSync(filePath)) { return 0; }
  var head = fs.readFileSync(filePath);
  if (!head || head.length < 1) { return 0; }
  return parseInt(head.toString());
}

function getFullPath(basePath, filePath) {
  return path.join(basePath, filePath );
}

function findLatest() {
  var revisions = fs.readdirSync(path.join(CMD_DIRECTORY,VCS_DIRECTORY))
    .filter(function(filePath) {
      var fullPath = path.join(CMD_DIRECTORY,VCS_DIRECTORY,filePath);
      var stat = fs.statSync(fullPath);
      return stat.isDirectory();
    })
    .map(function(item) {
      return parseInt(item);
    });
  if (revisions.length > 0) {
    var sorted = revisions
      .sort(function(a,b){ return b-a; });
    //console.log(sorted);
    return sorted[0];
  }
  return 0;
}

function getPaths(basePath) {
  return fs.readdirSync(basePath).filter(function(name) {
    return name !== VCS_DIRECTORY && 
      name !== 'node_modules' &&
      name !== '.myvcsignore';
  }).map(function(name){
    return {
      fullPath: getFullPath(basePath, name),
      fileName: name
    };
  });
}

var commands = module.exports = {
  backup : function() {
    var parts = Array.prototype.slice.call(arguments);
    if (parts.length > 0 && parts[0].toLowerCase() === '-m') {
      parts = parts.slice(1);
    }
    var message = parts.join(" ");
    return new RSVP.Promise(function(resolve, reject) {
      var lasthead = getHead();
      var latestVersion = findLatest();
      var sources = getPaths(CMD_DIRECTORY);
      var destination = path.join(CMD_DIRECTORY,VCS_DIRECTORY,(latestVersion+1).toString());
      fs.mkdirSync(destination);
      var copied = 0;
      sources.forEach(function(source) {
        var target = path.join(destination, source.fileName);
        ncp(source.fullPath,target,{stopOnErr: true}, function(err) {
          if (err) {
            return reject(err);
          }
          copied += 1;
          if (copied == sources.length) {
            console.log('Successfuly made snapshot of revision ' + (latestVersion+1));
            writeHead(latestVersion+1);
            
            meta.log(lasthead,latestVersion+1, message);
            return resolve();
          }
        });
      });
    });
  },
  checkout : function(revision) {
    var source = path.join(CMD_DIRECTORY, VCS_DIRECTORY, revision.toString());
    if (!fs.existsSync(source)) {
      console.error('Revision ' + revision + ' does not exist.');
      return;
    }
    commands.backup('backing up current working copy, before checking out revision ' + revision)
      .then(function() {
        console.log('Checking out ' + revision + ' into working directory.');
        var sources = getPaths(source);
        var copied = 0;
        sources.forEach(function(source) {
          var target = path.join(CMD_DIRECTORY,source.fileName);
          ncp(source.fullPath,target,{stopOnErr: true}, function(err) {
            if (err) {
              console.log('Failed to checkout revision', revision);
              console.log('ERROR',err);
              return;
            }
            copied += 1;
            if (copied == sources.length) {
              writeHead(revision);
              console.log('Successfuly checked-out revision', revision);
            }
          });
        });
      });
  },
  latest: function() {
    commands.checkout(findLatest());
    writeHead(findLatest());
  },
  log: function() {
    meta.getLog(getHead()).then(function(logs){
      logs.forEach(function(log){
        console.log(
          log.rid + ' : ' +
          log.createdOn.toString('yyyy-MM-dd HH:mm:ss') + " -> " + log.message
        );
      });
    });
  },
  current: function() {
    console.log('Currently working on revision', getHead());
  }
};
