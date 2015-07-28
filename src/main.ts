/// <reference path = '../node_modules/typescript/bin/typescript.d.ts' />

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

  // Alphabet: ['$', '_','0' - '9', 'a' - 'z', 'A' - 'Z'].
  // Generates the next char in the alphabet, starting from '$',
  // and ending in 'Z'. If nextChar is passed in 'Z', it will 
  // start over from the beginning of the alphabet and return '$'.
  private nextChar(str: string): string {
    switch (str) {
      case '$':
        return '_';
      case '_':
        return '0';
      case '9':
        return 'a';
      case 'z':
        return 'A';
      case 'Z':
        return '$';
      default:
        return String.fromCharCode(str.charCodeAt(0) + 1);
    }
  }

  private checkReserved(str: string): boolean {
    // From MDN's Lexical Grammar page
    // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar)
    var reserved = {
      'break' : true,
      'case': true,
      'class': true,
      'catch': true,
      'const': true,
      'continue': true,
      'debugger': true,
      'delete': true,
      'do': true,
      'else': true,
      'export': true,
      'extends': true,
      'finally': true,
      'for': true,
      'function': true,
      'if': true,
      'import': true,
      'in': true,
      'instanceof': true,
      'let': true,
      'new': true,
      'return': true,
      'super': true,
      'switch': true,
      'this': true,
      'throw': true,
      'try': true,
      'typeof': true,
      'var': true,
      'void': true,
      'while': true,
      'with': true,
      'yield': true,
      'enum': true,
      'await': true,
      'int': true,
      'byte': true,
      'char': true,
      'goto': true,
      'long': true,
      'final': true,
      'float': true,
      'short': true,
      'double': true,
      'native': true,
      'throws': true,
      'boolean': true,
      'abstract': true,
      'volatile': true,
      'transient': true,
      'synchronized': true
    };

    return (reserved[str] ? true : false);
  }

  // Given the last code, returns a string for the new property name.
  // ie: given 'a', will return 'b', given 'az', will return 'aA', etc. ...
  generateNextPropertyName(code: string): string {
    var chars = code.split('');
    var len: number = code.length;
    var firstChar = '$';
    var lastChar = 'Z';

    if (len === 0) {
      return firstChar;
    }

    /* Grab the next letter using nextChar */
    for (var i = len - 1; i >= 0; i--) {
      if (chars[i] !== lastChar) {
        chars[i] = this.nextChar(chars[i]);
        break;
      } else {
        chars[i] = firstChar;
        if (i === 0) {
          return firstChar + (chars.join(''));
        }
      }
    }
    var newName = chars.join('');
    if (this.checkReserved(newName)) {
      return this.generateNextPropertyName(newName);
    } else {
      return newName;
    }
  }
}
