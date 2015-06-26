/// <reference path="../../typings/mocha/mocha.d.ts"/>
import {Transpiler} from '../../src/main';

var assert = require('assert');

describe('Hello World', function() {
  it('The first char of "Hello World" should be "H"', function() {
    assert.equal('H', "Hello World"[0]);
  })
});

describe('Next lateral property name', function() {
  it('generates the next shortname for a property', function() {
    var transpiler = new Transpiler(); // why does this not work?
    assert.equal(transpiler.generate_next_lateral_property_name('a'), 'b');
    assert.equal(transpiler.generate_next_lateral_property_name('zz'), 'aaa');
    assert.equal(transpiler.generate_next_lateral_property_name('ba'), 'bb');
  })
});