import * as ts from 'typescript';
import * as assert from 'assert';

function bar(): ts.TextChange {
	return { span: null, newText: 'hi' };
}

var x = bar();
assert(x.hasOwnProperty('span'), 'true');

var y: ts.TextChange = { span: null, newText: 'omg!' };
assert(y.hasOwnProperty('newText'), 'true');

console.log('external_return.ts: Assertions Passed');
