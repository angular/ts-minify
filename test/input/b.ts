import * as a from './a';
import * as assert from 'assert';

var foo = new a.Foo();

foo.bar = 'bar';

assert.equal(foo.bar, 'bar');
console.log('b.ts: Assertion Passed');