///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript.d.ts"/>

import ts = require('typescript');
import fs = require('fs'); // filesystem module
import util = require('util');
import path = require('path');
//import process = require('process');

// export const COMPILER_OPTIONS: ts.CompilerOptions = {
// 	allowNonTsExtensions: true,
// 	module: ts.ModuleKind.CommonJS,
// 	target: ts.ScriptTarget.ES5,
// };

/* TranspilerOptions Class will go here */


/* The Transpiler Class */
export class Transpiler {
	private output: string; // for now, what is an output object?
	private currentFile: ts.SourceFile;

	// last comment index?
	private errors: string[] = [];

	//private transpilers;
	// (Transpiler options here when I know what's needed) 

	constructor() {
		// will instantiate different transpilers; nothing here yet

	} 

	compile(fileNames: string[], options: ts.CompilerOptions): void {
	    var program = ts.createProgram(fileNames, options);
	    var emitResult = program.emit();

	    var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

	    allDiagnostics.forEach(diagnostic => {
	        var loc = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
	        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
	        console.log(`${diagnostic.file.fileName} (${loc.line + 1},${loc.character + 1}): ${message}`);
	    });

	    var exitCode = emitResult.emitSkipped ? 1 : 0;
	    console.log(`Process exiting with code '${exitCode}'.`);
	    process.exit(exitCode);
	}

	callCompile() {
		this.compile(process.argv.slice(2), {
			noEmitOnError: true, noImplicitAny: true,
			target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
		});
	}

	transform() {

	}

	// return set options for the compiler
	private getCompilerOptions(): ts.CompilerOptions {
		const options: ts.CompilerOptions = {
			allowNonTsExtensions: true,
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES6,
		};
		return options;
	}

	/* Create a Transpiler Class */
	createCompilerHost(fileNames: string[], options?: ts.CompilerOptions): ts.CompilerHost {
		console.log("create compiler host");
		console.log(fileNames);

		// why is this needed? rather, what is the point?
		var fileMap: { [s: string]: boolean } = {};
		fileNames.forEach((f) => fileMap[f] = true); // why?

		// sanity check that given files actually exist
		fileNames.forEach((fpath) => {
			fs.exists(fpath, function(exists) {
				console.log(exists ? "exists" : "nope :(");
			});
		});

		// the methods of a compiler host object
		return {
			getSourceFile: (sourceName, languageVersion) => {
				console.log('does this occur');
				if (fileMap.hasOwnProperty(sourceName)) {
					console.log('hello?');
					var contents = fs.readFileSync(sourceName, 'UTF-8');
					console.log(contents);
					return ts.createSourceFile(sourceName, contents, this.getCompilerOptions().target, true);
				} 
				if (sourceName === "lib.d.ts")
					return ts.createSourceFile(sourceName, '', this.getCompilerOptions().target, true);
				return undefined;
			},
			// these are not used; just exist to satisfy interface?
			writeFile: function(name, text, writeByteOrderMark, outputs) {
				fs.writeFile(name, text);
			},
			getDefaultLibFileName: function() { return "lib.d.ts"; },
			useCaseSensitiveFileNames: function() { return true; },
			getCanonicalFileName: function(filename) { return filename; },
			getCurrentDirectory: function() { return ""; },
			getNewLine: function() { return "\n"; }
		};
	}
}

var transpiler = new Transpiler();
// var host = transpiler.createCompilerHost(['test/hello.ts']);
// var source = host.getSourceFile('test/hello.ts', ts.ScriptTarget.ES6);
// console.log(source);
transpiler.callCompile();
