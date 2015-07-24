/// <reference path='../../typings/mocha/mocha.d.ts'/>
/// <reference path='../../typings/chai/chai.d.ts'/>
/// <reference path='../../typings/node/node.d.ts'/>

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

describe('Visitor pattern', () => {
  it('shows correctly appends "$mangled" to an identifier of a property access expression', () => {
    expectTranslate('Math.random();').to.equal('Math.random$mangled();');
    expectTranslate('Class Foo { a: string; constructor() {} b() { this.a = "hello"; } }')
        .to.equal('Class Foo { a: string; constructor() {} b() { this.a$mangled = "hello"; } }');
    expectTranslate('for (x in foo.bar) { var y = foo.bar.baz; }')
        .to.equal('for (x in foo.bar$mangled) { var y = foo.bar$mangled.baz$mangled; }');
    expectTranslate('var x = foo.baz();').to.equal('var x = foo.baz$mangled();');
  });
});

describe('Next property name generation', () => {
  it('correctly generates a new shortname/alias', () => {
    var minifier = new Minifier();
    assert.equal(minifier.generateNextPropertyName('a'), 'b');
    assert.equal(minifier.generateNextPropertyName('ab'), 'ac');
    assert.equal(minifier.generateNextPropertyName(''), '$');
    assert.equal(minifier.generateNextPropertyName('$'), '_');
    assert.equal(minifier.generateNextPropertyName('_'), '0');
    assert.equal(minifier.generateNextPropertyName('$a'), '$b');
    assert.equal(minifier.generateNextPropertyName('$_'), '$0');
    assert.equal(minifier.generateNextPropertyName('z'), 'A');
    assert.equal(minifier.generateNextPropertyName('A'), 'B');
    assert.equal(minifier.generateNextPropertyName('9'), 'a');
    assert.equal(minifier.generateNextPropertyName('Z'), '$$');
    assert.equal(minifier.generateNextPropertyName('az'), 'aA');
  });
  it('correctly skips over reserved keywords', () => {
    var minifier = new Minifier();
    // skips generating 'in', which is a reserved word
    assert.equal(minifier.generateNextPropertyName('im'), 'io');
  })
});
