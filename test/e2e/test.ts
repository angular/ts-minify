/// <reference path="../../typings/mocha/mocha.d.ts"/>
import {Renamer} from '../../src/main';

var assert = require('assert');

describe('Hello World', function() {
	it('The first char of "Hello World" should be "H"', function() {
			assert.equal('H', "Hello World"[0]);
	})
});

describe('Next lateral property name', function() {
	it('generates the next shortname for a property', function() {
		var transpiler = new Renamer();
		assert.equal(transpiler.generateNextLateralPropertyName('a'), 'b');
		assert.equal(transpiler.generateNextLateralPropertyName('zz'), 'aaa');
		assert.equal(transpiler.generateNextLateralPropertyName('ba'), 'bb');
	})
});

describe('output paths', function() {
	it('writes in the path of the original file & generates <original_name>-renamed.ts', function() {
		var transpiler = new Renamer();
		console.log(process.cwd());
		assert.equal(transpiler.getOutputPath('test/hello.ts'), 'test/hello-renamed.ts');
		assert.notEqual(transpiler.getOutputPath('test/hello.ts'), 'test/renamed.ts');
	})
});

/* Test for recursive tree walk */
/* ..... */
/* ..... */
/* ..... */

/* Test for type checker */
/* ..... */
/* ..... */
/* ..... */