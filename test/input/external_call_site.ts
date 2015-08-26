import * as ts from 'typescript';
import * as assert from 'assert';

function f(a: { newText: string }) {
	a.newText = 'foobar';
	return a.newText;
}

var x = f(new ts.TextChange());
assert(x, 'foobar');
console.log('external_call_site.ts: Assertion Passed');
