/// <reference path="../typings/mocha/mocha.d.ts"/>
/// <reference path="../typings/chai/chai.d.ts"/>
/// <reference path="../typings/node/node.d.ts"/>
import * as main from '../src/main';
import * as ts from 'typescript';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as chai from 'chai';

export type StringMap = { [k: string]: string };
export type Input = string | StringMap;

var fileNames = ['test/input/basic_greeter.ts'];
var compilerOptions = main.COMPILER_OPTIONS;
var defaultLibName = ts.getDefaultLibFileName(compilerOptions); /* Not sure what this is */
var libSource = fs.readFileSync(ts.getDefaultLibFilePath(compilerOptions), 'utf-8'); /* ??? */
var libSourceFile: ts.SourceFile; 

export function expectTranslate(tsCode: Input) {
	var result = translateSource(tsCode);
	return chai.expect(result);
}

/* Takes a StringMap of file names, and outputs a TS Program */
export function parseFiles(nameToContent: StringMap): ts.Program {
	var result: string;
	var compilerHost: ts.CompilerHost = {
    getSourceFile: function(sourceName, languageVersion) {
    if (nameToContent.hasOwnProperty(sourceName)) {
      return ts.createSourceFile(sourceName, nameToContent[sourceName], compilerOptions.target,
	                                  true);
	  }
    if (sourceName === defaultLibName) {
        if (!libSourceFile) {
          // Cache to avoid excessive test times.
          libSourceFile = ts.createSourceFile(sourceName, libSource, compilerOptions.target, true);
        }
        return libSourceFile;
      }
      return undefined;
    },
    writeFile: function(name, text, writeByteOrderMark) { result = text; },
    getDefaultLibFileName: () => defaultLibName,
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => '',
    getNewLine: () => '\n'
	};

	var entryPoints = Object.keys(nameToContent);
	var program: ts.Program = ts.createProgram(entryPoints, compilerOptions, compilerHost);
	/* TODO: error handling goes here */
	return program;
}

export function translateSources(contents: Input): StringMap {
	var transpiler = new main.Transpiler();

	/* Enable stupid mode by default */
	transpiler.stupidMode = true;

	var namesToContent: StringMap;
	if (typeof contents === 'string') {
		namesToContent = {};
		namesToContent['test.ts'] = contents; 
	} else {
		namesToContent = contents;
	}
	var program = parseFiles(namesToContent);
	/* Translate the program */
	return transpiler.translateProgram(program);
}

export function translateSource(contents: Input): string {
	var results = translateSources(contents);
	return results['test.ts'];
} 


