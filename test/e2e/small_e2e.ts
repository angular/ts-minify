import {Minifier, options, MinifierOptions} from '../../src/main';
var tsc = require('typescript-compiler');

function runE2ETests() {
	// base path is set to ts-minfy/
	var minifier = new Minifier({ failFast: true, basePath: '../..' });
	minifier.renameProgram(['../input/e2e_input.ts'], '../../build/output');
	// compile renamed program
	tsc.compile(['../../build/output/e2e_input.ts'], '--module commonjs --out ../../build/output/e2e_input.js');
	require('../../build/output/e2e_input.js');
}
