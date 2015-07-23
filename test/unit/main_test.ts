/// <reference path="../../typings/mocha/mocha.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>

import * as assert from 'assert';
import * as ts from 'typescript';
import * as chai from 'chai';
import {Minifier, options} from '../../src/main';

export type StringMap = { [k: string]: string };
export type Input = string | StringMap;

function expectTranslate(code: string) {
  var result = translateSource(code);
  return chai.expect(result);
}

function parseFile(fileName: string, fileContent: string): ts.Program {
  var defaultLibName = ts.getDefaultLibFilePath(options);
  var compilerHost: ts.CompilerHost = {
		getSourceFile: function(sourceName, languageVersion) {
      return ts.createSourceFile(sourceName, fileContent, options.target, true);
    },
    writeFile: function(name, text, writeByteOrderMark) { var result = text; },
    getDefaultLibFileName: () => defaultLibName,
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => '',
    getNewLine: () => '\n'
  };

  var sourceFile = ts.createSourceFile(fileName, fileContent, options.target, true);
  var program = ts.createProgram([fileName], options, compilerHost);

  return program;
}

function translateSource(content: string): string {
	var minifier = new Minifier();
	var program = parseFile('test.ts', content);
	var result = '';

	program.getSourceFiles().forEach((sf) => {
		if (!sf.fileName.match(/\.d\.ts$/)&& !!sf.fileName.match(/\.[jt]s$/)) {
			console.log('-----------------------------');
			console.log(sf.fileName);
			result += minifier.visit(sf);
		}
	});
	return result;
}

describe('Equality statement',
	() => { it('shows that 1 equals 1', () => { assert.equal(1, 1); }) });

describe('types', () => {
	it('supports typing for basic types', () => {
		expectTranslate('var isDone: boolean;').to.equal('var isDone: boolean;');
		expectTranslate('var height: number;').to.equal('var height: number;');
		expectTranslate('var name: string;').to.equal('var name: string;');
		expectTranslate('var notSure: any;').to.equal('var notSure: any;');
		expectTranslate('function x(): void;').to.equal('function x(): void;');
	});
	it('supports array types', () => {
		expectTranslate('var list:number[];').to.equal('var list:number[];');
		expectTranslate('var list:Array<number>;').to.equal('var list:Array<number>;');
	});
	it('supports enums', () => {
		expectTranslate('enum Color {Red, Green, Blue};').to.equal('enum Color {Red, Green, Blue};');
		expectTranslate('enum Color {Red = 1, Green, Blue};').to.equal('enum Color {Red = 1, Green, Blue};');
	});
	it('supports type arguments', () => {
		expectTranslate('class X<A, B> { a: A; }').to.equal('class X<A, B> { a: A; }');
	});
});

describe('functions', () => {
	it('supports function declarations', () => {
		expectTranslate('function x() {}').to.equal('function x() {}');
	});
	it('supports param default values', () => {
		expectTranslate('function x(a = 42, b = 1) { return 42; }').to.equal('function x(a = 42, b = 1) { return 42; }');
		expectTranslate('function x(a = 42, b) { return 42; }').to.equal('function x(a = 42, b) { return 42; }')
	});
	it('supports optional parameters', () => {
		expectTranslate('function x(a?) { return 42; }').to.equal('function x(a?) { return 42; }');
	});
	it('supports empty return statements', () => {
		expectTranslate('function x() { return; }').to.equal('function x() { return; }');
	});
	it('supports named parameters', () => {
		expectTranslate('function x({color: string; area: number}) { return; }').to.equal('function x({color: string; area: number}) { return; }');
	})
});

describe('interfaces', () => {
	it('declares an interface', () => {
		expectTranslate('interface SquareConfig {}').to.equal('interface SquareConfig {}');
	})
});

describe('classes', () => {
	it('supports constructors', () => {
		expectTranslate('class Clock { constructor() {} }').to.equal('class Clock { constructor() {} }');
	});

	it('should support extends', () => { 
		expectTranslate('class X extends Y {}').to.equal('class X extends Y {}'); 
	});

	it('should support implements', () => { 
		expectTranslate('class X implements Y {}').to.equal('class X implements Y {}'); 
	});

	it('should support visibility modifiers', () => {
		expectTranslate('class X { private _x; }').to.equal('class X { private _x; }'); 
		expectTranslate('class X { public x; }').to.equal('class X { public x; }'); 
		expectTranslate('class X { protected x; }').to.equal('class X { protected x; }');
	});

	it('should support static fields', () => {
		expectTranslate('class X { static x: number = 42; }').to.equal('class X { static x: number = 42; }');
	});

	it('should suppport creating an instance of a class', () => {
		expectTranslate('x = new X("blah");').to.equal('x = new X("blah");');
	});
});

describe('modules', () => {
	it('should support modules', () => {
		expectTranslate('module Validation {}').to.equal('module Validation {}');
		//expectTranslate('import someMod = require("someModule");').to.equal('import someMod = require("someModule");');
		console.log(translateSource('import someMod = require("cats");')); // TODO: go over with rado, what is happening here?
	});
});

describe('expressions', () => {
	it('does math', () => {
		expectTranslate('1 + 2').to.equal('1 + 2');
		expectTranslate('1 - 2').to.equal('1 - 2');
		expectTranslate('1 / 2').to.equal('1 / 2');
		expectTranslate('1 * 2').to.equal('1 * 2');
		expectTranslate('1 % 2').to.equal('1 % 2');
		expectTranslate('x++').to.equal('x++');
		expectTranslate('x--').to.equal('x--');
		expectTranslate('++x').to.equal('++x');
		expectTranslate('--x').to.equal('--x');
	});
	it('shows correctly appends "$mangled" to an identifier of a property access expression', function() {
		expectTranslate('Math.random();').to.equal('Math.random$mangled();');
	});
});
