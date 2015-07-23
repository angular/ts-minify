/// <reference path='../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = false;

export const options: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES5,
};

export class Minifier {
  constructor() {}

  checkForErrors(program: ts.Program) {
    var errors = [];
    var emitResult = program.emit();
    var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      if (diagnostic.file && !diagnostic.file.fileName.match(/\.d\.ts$/)) {
        var {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errors.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(
          'Malformed TypeScript: Please check your source-files before attempting to use ts-minify.\n' +
          errors.join('\n'));
    }
  }
}