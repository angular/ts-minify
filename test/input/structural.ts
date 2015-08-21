/// <reference path ='../../node_modules/typescript/bin/typescript.d.ts' />
// import * as ts from 'typescript';

// function hasFlag(n: { newText: string }): boolean {
// 	n.newText;
//     return false;
// }

// var x: ts.TextChange = new ts.TextChange();

// hasFlag(x);


// function foo(n: { blah: string }) {
// 	n.blah;
// }

// foo({ blah: 'hello' });

import * as ts from 'typescript';

function hasFlag(n: { newText: string }): boolean {
	n.newText;
    return false;
}

var x: ts.TextChange = new ts.TextChange();

hasFlag(x);


function foo(n: { $: string }) {
	n.$;
}

foo({ $: 'hello' });