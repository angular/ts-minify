import * as ts from 'typescript';
import * as assert from 'assert';

function f(a: { newText: string }) {
	a.newText = 'hello!';
	return a;
}

var x = f(new ts.TextChange());
assert(x.hasOwnProperty('newText'), 'true');
console.log('external_call_site.ts: Assertion Passed');
