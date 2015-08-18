/// <reference path='../../typings/node/node.d.ts'/>

import * as a from './a';
import * as assert from 'assert';

var foo = new a.Foo();

foo.bar = 'bar';
assert.equal(foo.bar, 'bar');
console.log('Assertion passed');
