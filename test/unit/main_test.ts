/// <reference path="../../typings/mocha/mocha.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>

import * as assert from 'assert';
import * as ts from 'typescript';
import * as chai from 'chai';
import {Minifier, options} from '../../src/main';

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
  var sourceFiles = program.getSourceFiles();
  var namesToContents = {};

  sourceFiles.forEach((sf) => {
    // if (not a .d.ts file) and (is a .js or .ts file)
    if (!sf.fileName.match(/\.d\.ts$/) && !!sf.fileName.match(/\.[jt]s$/)) {
      namesToContents[sf.fileName] = minifier.visit(sf);
    }
  });
  return namesToContents['test.ts'];
}

describe('Equality statement', () => {it('shows that 1 equals 1', () => { assert.equal(1, 1); })});

describe('types', () => {
  it('supports array types', () => {
    expectTranslate('var list:number[];').to.equal('var list:number[];');
    expectTranslate('var list:Array<number>;').to.equal('var list:Array<number>;');
  });
  it('supports enums', () => {
    expectTranslate('enum Color {Red, Green, Blue};').to.equal('enum Color {Red, Green, Blue};');
    expectTranslate('enum Color {Red = 1, Green, Blue};')
        .to.equal('enum Color {Red = 1, Green, Blue};');
  });
  it('supports type arguments',
     () => { expectTranslate('class X<A, B> { a: A; }').to.equal('class X<A, B> { a: A; }'); });
});

describe('functions', () => {
  it('supports function declarations',
     () => { expectTranslate('function x(): void {}').to.equal('function x(): void {}'); });
  it('supports param default values', () => {
    expectTranslate('function x(a = 42, b = 1) { return 42; }')
        .to.equal('function x(a = 42, b = 1) { return 42; }');
    expectTranslate('function x(a = 42, b) { return 42; }')
        .to.equal('function x(a = 42, b) { return 42; }')
  });
  it('supports optional parameters', () => {
    expectTranslate('function x(a?) { return 42; }').to.equal('function x(a?) { return 42; }');
  });
  it('supports empty return statements',
     () => { expectTranslate('function x() { return; }').to.equal('function x() { return; }'); });
  it('supports named parameters', () => {
    expectTranslate('function x({color: string; area: number}) { return; }')
        .to.equal('function x({color: string; area: number}) { return; }');
  });
  it('supports rest parameters', () => {
    expectTranslate('function x(a: string, ...b: string[])) {}')
        .to.equal('function x(a: string, ...b: string[])) {}');
  });
  it('supports lambdas', () => { expectTranslate('() => {}').to.equal('() => {}'); });
});

describe('interfaces', () => {it('supports interface declaration', () => {
                         expectTranslate('interface SquareConfig {}')
                             .to.equal('interface SquareConfig {}');
                       })});

describe('variables', () => {
  it('supports variable declaration', () => {
    expectTranslate('var isDone: boolean;').to.equal('var isDone: boolean;');
    expectTranslate('var height: number;').to.equal('var height: number;');
    expectTranslate('var name: string;').to.equal('var name: string;');
    expectTranslate('var notSure: any;').to.equal('var notSure: any;');
    expectTranslate('var a = 1, b = 0;').to.equal('var a = 1, b = 0;');
  });
  it('supports const', () => {
    expectTranslate('const A = 1, B = 2;').to.equal('const A = 1, B = 2;');
    expectTranslate('const A: number = 1;').to.equal('const A: number = 1;');
  });
});

describe('classes', () => {
  it('supports constructors', () => {
    expectTranslate('class Clock { constructor() {} }')
        .to.equal('class Clock { constructor() {} }');
  });

  it('supports extends',
     () => { expectTranslate('class X extends Y {}').to.equal('class X extends Y {}'); });

  it('supports implements',
     () => { expectTranslate('class X implements Y {}').to.equal('class X implements Y {}'); });

  it('supports visibility modifiers', () => {
    expectTranslate('class X { private _x; }').to.equal('class X { private _x; }');
    expectTranslate('class X { public x; }').to.equal('class X { public x; }');
    expectTranslate('class X { protected x; }').to.equal('class X { protected x; }');
  });

  it('supports static fields', () => {
    expectTranslate('class X { static x: number = 42; }')
        .to.equal('class X { static x: number = 42; }');
  });

  it('should suppport creating an instance of a class',
     () => { expectTranslate('x = new X("blah");').to.equal('x = new X("blah");'); });
});

describe('modules', () => {
  it('supports modules',
     () => { expectTranslate('module Validation {}').to.equal('module Validation {}'); });
  it('supports import equals statements', () => {
    expectTranslate('import someMod = require("someModule");')
        .to.equal('import someMod = require("someModule");');
  });
  it('supports import from statements', () => {
    expectTranslate('import * as ts from "typescript";')
        .to.equal('import * as ts from "typescript";');
    expectTranslate('import {x} from "./y";').to.equal('import {x} from "./y";');
    expectTranslate('import {Foo as Bar} from "baz";').to.equal('import {Foo as Bar} from "baz";');
    expectTranslate('import {} from "baz";').to.equal('import {} from "baz";');
  });
});

describe('exports', () => {
  it('supports export equals statements', () => {
    expectTranslate('export = LettersOnlyValidator;').to.equal('export = LettersOnlyValidator;');
  });
  it('allows class exports',
     () => { expectTranslate('export class Polygons {}').to.equal('export class Polygons {}'); });
  it('allows variable exports',
     () => { expectTranslate('export var x = 10;').to.equal('export var x = 10;'); });
  it('allows export declarations',
     () => { expectTranslate('export * from "X";').to.equal('export * from "X";'); });
  it('allows named export declarations',
     () => { expectTranslate('export {a, b} from "X";').to.equal('export {a, b} from "X";'); });
  it('allows renamed exports', () => {
    expectTranslate('export {Foo as Bar} from "baz";').to.equal('export {Foo as Bar} from "baz";');
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
  it('shows correctly appends "$mangled" to an identifier of a property access expression',
     () => { expectTranslate('Math.random();').to.equal('Math.random$mangled();'); });
});
