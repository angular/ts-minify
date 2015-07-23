/// <reference path='../../typings/mocha/mocha.d.ts'/>
/// <reference path='../../typings/chai/chai.d.ts'/>

import * as assert from 'assert';
import {Minifier, options} from '../../src/main';
import * as chai from 'chai';
import * as ts from 'typescript';

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

describe('Equality statement', () => {it('shows that 1 equals 1', () => { assert.equal(1, 1); })});

describe('Recognizes invalid TypeScript inputs', () => {
  it('expects a "Malformed TypeScript" error when fed invalid TypeScript', () => {
    var minifier = new Minifier();
    var program = parseFile('test.ts', 'function x console.log("hello"); }');
    chai.expect(() => minifier.checkForErrors(program)).to.throw(/Malformed TypeScript/);
  });
  it('does not throw an error when fed valid TypeScript', () => {
    var minifer = new Minifier;
    var program = parseFile('test.ts', '(function blah() {})');
    chai.expect(() => minifer.checkForErrors(program)).to.not.throw();
  })
});
