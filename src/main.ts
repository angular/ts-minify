/// <reference path='../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = false;

export const options : ts.CompilerOptions = {
	allowNonTsExtensions: true,
	module: ts.ModuleKind.CommonJS,
	target: ts.ScriptTarget.ES5,
};

export class Transpiler {
  constructor() {}

  transple(filenames:string[]) {

  }

  checkForErrors(program: ts.Program) {
    var errors = [];
    var emitResult = program.emit();

    console.log(emitResult);

    var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    console.log('ALL DIAGNOSTICS');

    // filter out undefined files and ignore .d.ts files
		// TODO: Ask Martin about this error:
		// 	error TS2345: Argument of type '(diagnostic: Diagnostic) => void' 
		//  is not assignable to parameter of type '(value: Diagnostic, index: number, array: Diagnostic[]) => boolean'.
  	// 	Type 'void' is not assignable to type 'boolean'.
    allDiagnostics.filter((diagnostic) => { (diagnostic.file !== undefined); })
    						  .filter((diagnostic) => { !diagnostic.file.fileName.match(/\.d\.ts$/); })
    						  .forEach(diagnostic => {
										var { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      							var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
		    						errors.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    						  });

    	console.log(errors);

	    if (errors.length > 0) {
				throw new Error('MALFORMED TYPESCRIPT\n' + errors.join('\n'));
	    }
  }

	visit(node: ts.Node) {
		switch(node.kind) {

			case ts.SyntaxKind.PropertyAccessExpression:
				result = '';
				var pae = <ts.PropertyAccessExpression>node;
				result += this.visit(pae.expression);
				result += '.';
				result += pae.name.text + '!!!!!!';

				break;

			default:
				var text = node.getText();
				var children = node.getChildren();
				var result = '';
				var prevEnd = 0 ;
				children.forEach((child) => {
					var childText = this.visit(child);
					var childRange = {'start': child.getStart() - node.getStart(), 'end': child.getEnd() - node.getStart() };
					result += text.substring(prevEnd, childRange.start) + childText;
					prevEnd = childRange.end;
				});

				result += text.substring(prevEnd, text.length);

				if (DEBUG) {
					console.log('-------------------------------------');
					console.log(node.kind + ': ' + (<any>ts).SyntaxKind[node.kind]);
					console.log('RESULT: ' + result );
					console.log('TEXT: ' + text);
					console.log('start: ' + node.getStart() + ' end: ' + node.getEnd());
				}
				break;
		}
		return result;
	}
}

// var host = ts.createCompilerHost(options);
// var program = ts.createProgram(['../../test/input/class_decl.ts'], options, host);
// var typeChecker = program.getTypeChecker();
// var sourceFile = program.getSourceFile('../../test/input/class_decl.ts');
// var transpiler = new Transpiler();
// // console.log(transpiler.visit(sourceFile));

// transpiler.checkForErrors(program);
