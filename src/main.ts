/// <reference path='../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = false;

export const options: ts.CompilerOptions = {
  allowNonTsExten sions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES5,
};

class Transpiler {
  constructor() {}

	/* ================================================ */
  /* 	SHOULD BE ITS OWN PR WITH TESTS
  /* ================================================ */
  visit(node: ts.Node) {
    switch (node.kind) {
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

if (DEBUG) {
  var host = ts.createCompilerHost(options);
  var program = ts.createProgram(['../../test/input/class_decl.ts'], options, host);
  var typeChecker = program.getTypeChecker();
  var sourceFile = program.getSourceFile('../../test/input/class_decl.ts');
  var transpiler = new Transpiler();
  transpiler.checkForErrors(program);
}