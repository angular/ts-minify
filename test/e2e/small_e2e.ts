import {Minifier, options, MinifierOptions} from '../../src/main';
import * as ts from 'typescript';
var exec = require('child_process').exec;

export function runE2ETests() {
  // base path is set to ts-minfy/
  var minifier = new Minifier({failFast: true, basePath: '../..'});
  minifier.renameProgram(['../input/e2e_input.ts', '../../typings/node/node.d.ts'],
                         '../../build/output');
  // compile renamed program
  var child = exec('tsc', function(error, stdout, stderr) {
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
    if (error !== null) {
      console.log('exec error: ' + error);
    }
  });
  // execute the renamed and compiled program
  require('../../output/test/input/e2e_input');
}