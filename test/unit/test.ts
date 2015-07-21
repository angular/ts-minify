/// <reference path="../../typings/mocha/mocha.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>

import {Transpiler} from '../../src/main';
import * as ts from 'typescript';
import * as assert from 'assert';
import {expectTranslate, translateSources} from '../test_support';

const TEST_DEBUG = false;

describe('Next lateral property name', function() {
  it('generates the next shortname for a property', function() {
    var transpiler = new Transpiler();
    assert.equal(transpiler.generateNextLateralPropertyName(''), 'a');
    assert.equal(transpiler.generateNextLateralPropertyName('a'), 'b');
    assert.equal(transpiler.generateNextLateralPropertyName('zz'), 'aaa');
    assert.equal(transpiler.generateNextLateralPropertyName('ba'), 'bb');
  })
});

describe('output paths', function() {
  it('writes in the path of the original file & generates <original_name>_renamed.ts',
     function() {
       var transpiler = new Transpiler();
       assert.equal(transpiler.getOutputPath('test/greeter.ts'),
                    'test/greeter_renamed.ts');
       assert.notEqual(transpiler.getOutputPath('test/greeter.ts'),
                       'test/renamed.ts');
     })
});

describe('basic property renaming', function() {
  it('renames a declared property in a property access expression', function() {
    var input = `class Greeter {
			greeting: string;
			constructor(g) { this.greeting = g; }
		}`;
    if (TEST_DEBUG)
      console.log(input);
    var output =
        'class Greeter {a: string;constructor (g){this.a = g;}}';
    if (TEST_DEBUG)
      console.log(output);
    if (TEST_DEBUG)
      console.log('====================');
    if (TEST_DEBUG)
      console.log(expectTranslate(input));

    expectTranslate(input).to.equal(output);
  })
});

describe('function declaration', function() {
  it('correctly outputs a function declaration', function() {
    var input = `function hello() { console.log('hello'); }`;
    var output = `function hello() {console.log('hello');}`;
    expectTranslate(input).to.equal(output);
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