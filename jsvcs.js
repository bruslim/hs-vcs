/*jshint node: true */

'use strict';

var VCS_DIRECTORY = '.myvcs';

var fs = require('fs');

var vcs = require('./lib/vcs');

// copy to local var
var args = process.argv;
if (args.length <= 0) {
  process.exit(1);
}

// we are running via node, get rid of node and jsfile
if (args[0] === 'node'){
  args = args.slice(2, args.length);
}

if (vcs[args[0]]) {
  vcs[args[0]].apply(null, args.slice(1));
}