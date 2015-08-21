/// <reference path ='../node_modules/typescript/bin/typescript.d.ts' />
/// <reference path='../typings/fs-extra/fs-extra.d.ts' />
/// <reference path='../node_modules/typescript/bin/lib.es6.d.ts' />

import * as ts from 'typescript';
import * as path from 'path';
import * as fsx from 'fs-extra';
import * as fs from 'fs';

const DEBUG = false;

export const options: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES6,
};

export interface MinifierOptions {
  failFast?: boolean;
  basePath?: string;
}

export class Minifier {
  static reservedJSKeywords = Minifier.buildReservedKeywordsMap();
  // Key: (Eventually fully qualified) original property name
  // Value: new generated property name
  private _renameMap: {[name: string]: string} = {};
  private _typeCasting: Map<ts.Symbol, ts.Symbol[]> = <Map<ts.Symbol, ts.Symbol[]>>(new Map());
  private _lastGeneratedPropName: string = '';
  private _typeChecker: ts.TypeChecker;
  private _errors: string[] = [];

  constructor(private _minifierOptions: MinifierOptions = {}) {}

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

  setTypeChecker(typeChecker: ts.TypeChecker) { this._typeChecker = typeChecker; }

  reportError(n: ts.Node, message: string) {
    var file = n.getSourceFile();
    var fileName = file.fileName;
    var start = n.getStart(file);
    var pos = file.getLineAndCharacterOfPosition(start);
    var fullMessage = `${fileName}:${pos.line + 1}:${pos.character + 1}: ${message}`;
    this._errors.push(fullMessage);
    if (this._minifierOptions.failFast) {
      throw new Error(fullMessage);
    }
  }

  renameProgram(fileNames: string[], destination?: string) {
    var host = ts.createCompilerHost(options);
    var program = ts.createProgram(fileNames, options, host);
    this._typeChecker = program.getTypeChecker();

    let files = program.getSourceFiles().filter((sf) => !sf.fileName.match(/\.d\.ts$/));

    files.forEach((f) => {
      this.preprocessVisit(f);
    });

    // this._typeCasting.forEach((val, key) => {
    //   console.log('key ' + key.getName());
    //   console.log(this.isRenameable(key));
    // });

    files.forEach((f) => {
          var renamedTSCode = this.visit(f);
          console.log(renamedTSCode);
          var fileName = this.getOutputPath(f.fileName, destination);
          fsx.mkdirsSync(path.dirname(fileName));
          fs.writeFileSync(fileName, renamedTSCode);
        });
  }

  getOutputPath(filePath: string, destination: string = '.'): string {
    destination = path.resolve(process.cwd(), destination);
    var absFilePath = path.resolve(process.cwd(), filePath);

    // no base path, flatten file structure and output to destination
    if (!this._minifierOptions.basePath) {
      return path.join(destination, path.basename(filePath));
    }

    this._minifierOptions.basePath = path.resolve(process.cwd(), this._minifierOptions.basePath);

    // given a base path, preserve file directory structure
    var subFilePath = absFilePath.replace(this._minifierOptions.basePath, '');

    if (subFilePath === absFilePath) {
      return path.join(destination, filePath);
    }

    return path.join(destination, subFilePath);
  }

  isExternal(symbol: ts.Symbol): boolean {
    // figure out how to deal with undefined symbols (ie: in case of string literal)
    if (!symbol) return true;

    // if no declarations, assume primitive
    return symbol.declarations.some(
      (decl) => !!(decl.getSourceFile().fileName.match(/\.d\.ts/)));
  }  

  isRenameable(symbol: ts.Symbol): boolean {
    // console.log('=============================');
    // console.log(symbol.members);
    // console.log('=============================');
    // console.log(this._typeCasting.get(symbol));

    if (this.isExternal(symbol)) return false;
    if (!this._typeCasting.has(symbol)) return true;

    let renameable = false;
    this._typeCasting.get(symbol).forEach((castType) => {
      console.log(this.isExternal(castType));
      if (!this.isExternal(castType)) {
        renameable = true;
      }
    });

    return renameable;   

    // do check for intermediate case, where we throw an error if we have both trues and falses
    return false;
  }  

  // all preprocess before we start emitting
  preprocessVisit(node: ts.Node) {
    switch(node.kind) {
      case ts.SyntaxKind.CallExpression: {
        // expression, typedArguments?, arguments
        var callExpr = <ts.CallExpression>node;
        // console.log(this._typeChecker.getSymbolAtLocation(callExpr.expression));
        var lhsSymbol = this._typeChecker.getSymbolAtLocation(callExpr.expression);

        let paramSymbols: ts.Symbol[] = [];

        // this has expected infomration
        // TODO: understand cases of multiple declarations, pick
        // first declaration for now
        if (!lhsSymbol || !((<any>lhsSymbol.declarations[0]).parameters)) {
          node.getChildren().forEach((child) => {
            this.preprocessVisit(child);
          });
        } else {
          (<any>lhsSymbol.declarations[0]).parameters.forEach((param) => {
            console.log('=======================');
            paramSymbols.push(param.type.symbol);
            //console.log(param.getText());
            //console.log(this.isExternal(param.type.symbol));
            //this._typeCasting.set(param.type.symbol, []);
            //console.log(this._typeCasting.get(param.type.symbol));
          });

        let argsSymbols: ts.Symbol[] = [];

        // right hand side argument has actual type of parameter
        console.log('Right hand side');
        callExpr.arguments.forEach((arg) => {
          argsSymbols.push(this._typeChecker.getTypeAtLocation(arg).symbol);
        });

        paramSymbols.forEach((sym, i) => {
          if (this._typeCasting.has(sym)) {
            this._typeCasting.get(sym).push(argsSymbols[i]);
          } else {
            this._typeCasting.set(sym, [argsSymbols[i]]);
          }
        });

        node.getChildren().forEach((child) => {
          this.preprocessVisit(child);
        });
        }
        
      }
      default: {
        node.getChildren().forEach((child) => {
          this.preprocessVisit(child);
        });
      }
    }
  }

  // Recursively visits every child node, emitting text of the sourcefile that is not a part of
  // a child node.
  visit(node: ts.Node): string {
    switch (node.kind) {
      case ts.SyntaxKind.PropertyAccessExpression: {
        let pae = <ts.PropertyAccessExpression>node;
        let exprSymbol = this._getExpressionSymbol(pae);
        let output = '';
        let children = pae.getChildren();

        output += this.visit(pae.expression);
        output += pae.dotToken.getText();

        // if LHS is a module, do not rename property name
        var lhsTypeSymbol = this._typeChecker.getTypeAtLocation(pae.expression).symbol;
        var lhsIsModule = lhsTypeSymbol && ts.SymbolFlags.ValueModule === lhsTypeSymbol.flags;

        // Early exit when exprSymbol is undefined.
        if (!exprSymbol) {
          this.reportError(pae.name, 'Symbol information could not be extracted.\n');
          return;
        }

        var isExternal = exprSymbol.declarations.some(
            (decl) => !!(decl.getSourceFile().fileName.match(/\.d\.ts/)));

        // console.log(lhsTypeSymbol.getName(), this.isRenameable(exprSymbol));

        if (!this.isRenameable(lhsTypeSymbol) || isExternal || lhsIsModule) return output + this._ident(pae.name);
        return output + this._renameIdent(pae.name); 
      }
      // TODO: A parameter property will need to also be renamed in the
      // constructor body if the parameter is used there.
      // Look at Issue #39 for an example.
      case ts.SyntaxKind.Parameter: {
        var paramDecl = <ts.ParameterDeclaration>node;

        // if there are modifiers, then we know this is a declaration and an initialization at once
        // we need to rename the property
        if (this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Public) ||
            this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Private) ||
            this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Protected)) {
          return this.contextEmit(node, true);
        }

        return this.contextEmit(node);
      }
      // separate PR
      // TODO: INTERFACE AND PROPERTY SIGNATURE
      case ts.SyntaxKind.PropertySignature: {
        if (node.parent.kind === ts.SyntaxKind.TypeLiteral || node.parent.kind === ts.SyntaxKind.InterfaceDeclaration) {
          let parentSymbol = this._typeChecker.getTypeAtLocation(node.parent).symbol;
          let rename = this.isRenameable(parentSymbol);
          return this.contextEmit(node, rename);
        }
        return this.contextEmit(node);
      }
      // All have same wanted behavior.
      case ts.SyntaxKind.MethodDeclaration:
      case ts.SyntaxKind.PropertyAssignment:
      case ts.SyntaxKind.PropertyDeclaration: {
        return this.contextEmit(node, true);
      }
      default: { return this.contextEmit(node); }
    }
  }

  // if renameIdent is true, rename children identifiers in this node
  private contextEmit(node: ts.Node, renameIdent: boolean = false) {
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
      let childText = '';
      let hasName = (<any>node).name;
      if (renameIdent && child.kind === ts.SyntaxKind.Identifier && hasName === child) {
        childText = this._renameIdent(child);
      } else {
        childText = this.visit(child);
      }
      output += childText;
      prevEnd = childEnd;
    });
    output += nodeText.substring(prevEnd, nodeText.length);
    return output;
  }

  // n: modifiers array, flag: the flag we are looking for
  private hasFlag(n: {flags: number}, flag: ts.NodeFlags): boolean {
    return n && (n.flags & flag) !== 0;
  }

  private _getExpressionSymbol(node: ts.PropertyAccessExpression) {
    let exprSymbol = this._typeChecker.getSymbolAtLocation(node.name);
    // Sometimes the RHS expression does not have a symbol, so use the symbol at the property access
    // expression
    if (!exprSymbol) {
      exprSymbol = this._typeChecker.getSymbolAtLocation(node);
    }
    return exprSymbol;
  }

  private _renameIdent(node: ts.Node) { return this.renameProperty(this._ident(node)); }

  private _ident(node: ts.Node) { return node.getText(); }

  // Alphabet: ['$', '_','0' - '9', 'a' - 'z', 'A' - 'Z'].
  // Generates the next char in the alphabet, starting from '$',
  // and ending in 'Z'. If nextChar is passed in 'Z', it will
  // start over from the beginning of the alphabet and return '$'.
  private _nextChar(str: string): string {
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
    if (!this._renameMap.hasOwnProperty(name)) {
      this._renameMap[name] = this.generateNextPropertyName(this._lastGeneratedPropName);
    }
    return this._renameMap[name];
  }

  // Given the last code, returns a string for the new property name.
  // ie: given 'a', will return 'b', given 'az', will return 'aA', etc. ...
  // public so it is visible for testing
  generateNextPropertyName(code: string): string {
    var newName = this._generateNextPropertyNameHelper(code);
    this._lastGeneratedPropName = newName;
    return newName;
  }

  private _generateNextPropertyNameHelper(code: string) {
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
        chars[i] = this._nextChar(chars[i]);
        break;
      } else {
        chars[i] = firstChar;
        if (i === 0) {
          let newName = firstChar + (chars.join(''));
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
      return newName;
    }
  }
}

// var minifier = new Minifier();
// minifier.renameProgram(['../../test/input/structural.ts']);
