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

  // Recursively visits every child node, emitting text of the sourcefile that is not a part of
  // a child node.
  visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.PropertyAccessExpression: {
        let output = '';
        let propAccessExp = <ts.PropertyAccessExpression>node;
        output += this.visit(propAccessExp.expression);
        output += '.';
        // Adds '$mangled' to an identifier to ensure that the identifier is being altered.
        output += propAccessExp.name.text + '$mangled';
        return output;
      }
      default: {
        // The indicies of nodeText range from 0 ... nodeText.length - 1. However, the start and end
        // positions of nodeText that .getStart() and .getEnd() return are relative to
        // the entire sourcefile.
        let nodeText = node.getText();
        let children = node.getChildren();
        let output = '';
        // prevEnd is used to keep track of how much of nodeText has been copied over. It is updated
        // within the for loop below, and text from nodeText(0, prevEnd), including children text
        // that fall within the range, has already been copied over to output.
        let prevEnd = 0;
        // Loop-invariant: prevEnd should always be less than or equal to the start position of
        // an unvisited child node because the text before a child's text must be copied over to
        // the new output before anything else.
        children.forEach((child) => {
          // The start and end positions of the child's text must be updated so that they
          // are relative to the indicies of the parent's text range (0 ... nodeText.length - 1), by
          // off-setting by the value of the parent's start position. Now childStart and childEnd
          // are relative to the range of (0 ... nodeText.length).
          let childStart = child.getStart() - node.getStart();
          let childEnd = child.getEnd() - node.getStart();
          output += nodeText.substring(prevEnd, childStart);
          let childText = this.visit(child);
          output += childText;
          prevEnd = childEnd;
        });
        output += nodeText.substring(prevEnd, nodeText.length);
        return output;
      }
    }
  }
}