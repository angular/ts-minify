/// <reference path = '../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = true;

export const options: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES5,
};

export class Minifier {
  static reservedJSKeywords = Minifier.buildReservedKeywordsMap();
  private renameMap: {[name: string]: string} = {};
  private lastGeneratedPropName: string = '';

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
  visit(node: ts.Node, typeChecker?: ts.TypeChecker) {
    switch (node.kind) {
      case ts.SyntaxKind.Identifier: {
        let parent = node.parent;

        if (parent.kind === ts.SyntaxKind.PropertyDeclaration) {
          return this.renameIdent(node);
        } else if (parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
          let pae = <ts.PropertyAccessExpression>parent;
          let exprSymbol = typeChecker.getTypeAtLocation(pae.expression).symbol;
          if (!exprSymbol) {
            exprSymbol = typeChecker.getSymbolAtLocation(pae.expression);
          }
          if (!exprSymbol) {
            exprSymbol = typeChecker.getSymbolAtLocation(pae);
          }
          let childText = '';
          if (exprSymbol) {
            // start off by assuming the property is rename-able
            let rename: boolean = true;

            // check if a source filename of a declaration ends in .d.ts
            exprSymbol.declarations.forEach((decl) => {
              let fileName = decl.getSourceFile().fileName;
              if (fileName.match(/\.d\.ts/)) {
                rename = false;  // we can no longer rename the property
              }
            });

            if (rename) {
              childText = this.renameIdent(node);
            } else {
              childText = this.ident(node);
            }
          } else {
            childText = this.renameIdent(node);
          }
          return childText;
        } else if (parent.kind === ts.SyntaxKind.MethodDeclaration) {
          return this.renameIdent(node);
        } else {
          return this.ident(node);
        }
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
          let childText = this.visit(child, typeChecker);
          output += childText;
          prevEnd = childEnd;
        });
        output += nodeText.substring(prevEnd, nodeText.length);
        return output;
      }
    }
  }

  private renameIdent(node: ts.Node) {
    return this.renameProperty(node.getText());
  }

  private ident(node: ts.Node) { return node.getText(); }

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

  static buildReservedKeywordsMap(): {[name: string]: boolean} {
    var map: {[name: string]: boolean} = {};
    // From MDN's Lexical Grammar page
    // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar)
    var keywordList =
        ('break case class catch const continue debugger delete do else export extends finally for' +
         ' function if import in instanceof let new return super switch this throw try typeof var' +
         ' void while with yield enum await int byte char goto long final float short double' +
         ' native throws boolean abstract volatile transient synchronized')
            .split(' ');
    for (var i in keywordList) {
      map[keywordList[i]] = true;
    }
    return map;
  }

  private checkReserved(str: string): boolean {
    return Minifier.reservedJSKeywords.hasOwnProperty(str);
  }

  renameProperty(name: string): string {
    if (!this.renameMap.hasOwnProperty(name)) {
      let newName = this.generateNextPropertyName(this.lastGeneratedPropName);
      this.renameMap[name] = newName;
      this.lastGeneratedPropName = newName;
    }
    return this.renameMap[name];
  }

  // Given the last code, returns a string for the new property name.
  // ie: given 'a', will return 'b', given 'az', will return 'aA', etc. ...
  generateNextPropertyName(code: string): string {
    var chars = code.split('');
    var len: number = code.length;
    var firstChar = '$';
    var lastChar = 'Z';
    var firstAlpha = 'a';

    if (len === 0) {
      return firstChar;
    }

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
      // Property names cannot start with a number. Generate next possible property name that starts
      // with the first alpha character.
    } else if (chars[0].match(/[0-9]/)) {
      return (firstAlpha + Array(len).join(firstChar));
    } else {
      return newName;
    }
  }
}

