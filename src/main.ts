/// <reference path = '../node_modules/typescript/bin/typescript.d.ts' />

import * as ts from 'typescript';

const DEBUG = false;

export const options: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES5,
};

export class Minifier {
  static reservedJSKeywords = Minifier.buildReservedKeywordsMap();
  // Key: (Eventually fully qualified) original property name
  // Value: new generated property name
  private renameMap: {[name: string]: string} = {};
  private lastGeneratedPropName: string = '';
  private typeChecker: ts.TypeChecker;
  private errors: string[] = [];

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

  setTypeChecker(typeChecker: ts.TypeChecker) { this.typeChecker = typeChecker; }

  reportError(n: ts.Node, message: string) {
    var file = n.getSourceFile();
    var fileName = file.fileName;
    var start = n.getStart(file);
    var pos = file.getLineAndCharacterOfPosition(start);
    var fullMessage = `${fileName}:${pos.line + 1}:${pos.character + 1}: ${message}`;
    throw new Error(fullMessage);
    this.errors.push(fullMessage);
  }

  // Recursively visits every child node, emitting text of the sourcefile that is not a part of
  // a child node.
  visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.PropertyAccessExpression: {
        let pae = <ts.PropertyAccessExpression>node;
        let exprSymbol = this.getExpressionSymbol(pae);
        let output = '';
        let children = pae.getChildren();

        output += this.visit(pae.expression);
        output += pae.dotToken.getText();

        // Early exit when exprSymbol is undefined.
        if (!exprSymbol) {
          this.reportError(pae.name, 'Symbol information could not be extracted.\n');
        } else {
          // start off by assuming the property is rename-able
          let rename: boolean = true;

          // check if a source filename of a declaration ends in .d.ts
          for (var decl of exprSymbol.declarations) {
            let fileName = decl.getSourceFile().fileName;
            if (fileName.match(/\.d\.ts/)) {
              rename = false;  // we can no longer rename the property
              break;
            }
          }

          // Make sure to rename the property, not the LHS, which can also boil down to just an
          // Identifier.
          if (rename) {
            output += this.renameIdent(pae.name);
          } else {
            output += this.ident(pae.name);
          }
        }
        return output;
      }
      // These two have the same wanted behavior.
      case ts.SyntaxKind.PropertyAssignment:
      case ts.SyntaxKind.PropertyDeclaration: {
        let children = node.getChildren();
        let output = '';
        for (var child of children) {
          if (child.kind === ts.SyntaxKind.Identifier) {
            output += this.renameIdent(child);
          } else {
            output += this.visit(child);
          }
        }
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

  private getExpressionSymbol(node: ts.PropertyAccessExpression) {
    let exprSymbol = this.typeChecker.getSymbolAtLocation(node.name);

    // Sometimes the RHS expression does not have a symbol, so use the symbol at the property access
    // expression
    if (!exprSymbol) {
      exprSymbol = this.typeChecker.getSymbolAtLocation(node);
    }
    return exprSymbol;
  }

  private renameIdent(node: ts.Node) { return this.renameProperty(this.ident(node)); }

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
      this.renameMap[name] = this.generateNextPropertyName(this.lastGeneratedPropName);
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
      this.lastGeneratedPropName = firstChar;
      return firstChar;
    }

    for (var i = len - 1; i >= 0; i--) {
      if (chars[i] !== lastChar) {
        chars[i] = this.nextChar(chars[i]);
        break;
      } else {
        chars[i] = firstChar;
        if (i === 0) {
          let newName = firstChar + (chars.join(''));
          this.lastGeneratedPropName = newName;
          return newName;
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
      this.lastGeneratedPropName = newName;
      return newName;
    }
  }
}
