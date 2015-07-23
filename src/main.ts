/// <reference path='../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = true;

export const options: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES5,
};

export class Minifier {
  constructor() {}

  visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.PropertyAccessExpression:
        result = '';
        var pae = <ts.PropertyAccessExpression>node;
        result += this.visit(pae.expression);
        result += '.';
        // Adds '$mangled' to an identifier to ensure that the identifier is being altered.
        result += pae.name.text + '$mangled';
        break;

      default:
        var text = node.getText();
        var children = node.getChildren();
        var result = '';
        var prevEnd = 0;
        children.forEach((child) => {
          var childText = this.visit(child);
          var childRange = {
            'start': child.getStart() - node.getStart(),
            'end': child.getEnd() - node.getStart()
          };
          result += text.substring(prevEnd, childRange.start) + childText;
          prevEnd = childRange.end;
        });

        result += text.substring(prevEnd, text.length);

        /* REMOVE BEFORE CHECKING IN */
        if (DEBUG) {
          console.log('-------------------------------------');
          console.log(node.kind + ': ' + (<any>ts).SyntaxKind[node.kind]);
          console.log('RESULT: ' + result);
          console.log('TEXT: ' + text);
          console.log('start: ' + node.getStart() + ' end: ' + node.getEnd());
        }
        break;
    }
    return result;
  }
}

/* REMOVE BEFORE CHECKING IN */
// if (DEBUG) {
//   var host = ts.createCompilerHost(options);
//   var program = ts.createProgram(['../../test/input/import_stmt.ts'], options, host);
//   var sourceFile = program.getSourceFile('../../test/input/import_stmt.ts');
//   var typeChecker = program.getTypeChecker();
//   var minifier = new Minifier();
//   console.log('========================');
//   console.log(minifier.visit(sourceFile));
// }