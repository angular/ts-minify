/// <reference path ='../../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';
import * as assert from 'assert';

function f(a: { newText: string }) {
	a.newText = 'foobar';
	return a.newText;
}

f(new ts.TextChange());

