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
  target: ts.ScriptTarget.ES5,
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

  // Key: Type symbol at actual use sites (from)
  // Value: A list of the expected type symbol (to)
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

  // Renaming goes through a pre-processing step and an emitting step.
  renameProgram(fileNames: string[], destination?: string) {
    var host = ts.createCompilerHost(options);
    var program = ts.createProgram(fileNames, options, host);
    this._typeChecker = program.getTypeChecker();

    let sourceFiles = program.getSourceFiles().filter((sf) => !sf.fileName.match(/\.d\.ts$/));

    sourceFiles.forEach((f) => { this._preprocessVisit(f); });

    sourceFiles.forEach((f) => {
      var renamedTSCode = this.visit(f);
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
    // TODO: figure out how to deal with undefined symbols
    // (ie: in case of string literal, or something like true.toString(), 
    // the TypeScript typechecker will give an undefined symbol)
    if (!symbol) return true;

    return symbol.declarations.some((decl) => !!(decl.getSourceFile().fileName.match(/\.d\.ts/)));
  }

  isRenameable(symbol: ts.Symbol): boolean {
    if (this.isExternal(symbol)) return false;
    if (!this._typeCasting.has(symbol)) return true;

    let boolArrTypeCasting: boolean[] = [];

    // Three cases to consider:
    // CANNOT RENAME: Use site passes an internally typed object, expected site wants an externally
    // typed object OR use site passes externally typed object, but expected site wants an internally typed object
    // CAN RENAME: Use site type symbols are internal, expected type symbols are internal
    // ERROR: Expected symbol is external, use sites are both internal and external

    // Create boolean array of whether or not actual sites (type to which a symbol is being cast)
    // are internal
    if (this._typeCasting.has(symbol)) {
      for (let castType of this._typeCasting.get(symbol)) {
        boolArrTypeCasting.push(!this.isExternal(castType));
      }

      // Check if there are both true and false values in boolArrTypeCasting, throw Error
      if (boolArrTypeCasting.indexOf(true) >= 0 && boolArrTypeCasting.indexOf(false) >= 0) {
        throw new Error(
          'ts-minify does not support accepting both internal and external types at a use site\n' + 'Symbol name: ' + symbol.getName());
      }
    }

    // Since all values in boolArrayTypeCasting are all the same value, just return the first value
    return boolArrTypeCasting[0];
  }

  private _getAncestor(n: ts.Node, kind: ts.SyntaxKind): ts.Node {
    for (var parent = n; parent; parent = parent.parent) {
      if (parent.kind === kind) return parent;
    }
    return null;
  }

  private _hasAncestor(n: ts.Node, kind: ts.SyntaxKind): boolean {
    return !!this._getAncestor(n, kind);
  }

  private _preprocessVisitChildren(node: ts.Node) {
    node.getChildren().forEach((child) => { this._preprocessVisit(child); });
  }

  // Key - To: the expected type symbol
  // Value - From: the actual type symbol
  // IE: Coercing from type A to type B
  private _recordCast(from: ts.Symbol, to: ts.Symbol) {
    if (this._typeCasting.has(from)) {
      this._typeCasting.get(from).push(to);
    } else {
      this._typeCasting.set(from, [to]);
    }
  }

  // The preprocessing step is necessary in order to to find all typecasts (explicit and implicit) 
  // in the given source file(s). During the visit step (where renaming and emitting occurs), 
  // the information gathered from this step are used to figure out which types are internal to the
  // scope that the minifier is working with and which are external. This allows the minifier to 
  // rename properties more correctly.
  private _preprocessVisit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.CallExpression: {
        var callExpr = <ts.CallExpression>node;
        var lhsSymbol = this._typeChecker.getSymbolAtLocation(callExpr.expression);

        let paramSymbols: ts.Symbol[] = [];

        // TODO: understand cases of multiple declarations, pick first declaration for now
        if (!lhsSymbol || !((<any>lhsSymbol.declarations[0]).parameters)) {
          this._preprocessVisitChildren(node);
          break;
        } else {
          (<any>lhsSymbol.declarations[0])
              .parameters.forEach((param) => { paramSymbols.push(param.type.symbol); });

          let argsSymbols: ts.Symbol[] = [];

          // right hand side argument has actual type of parameter
          callExpr.arguments.forEach(
              (arg) => { argsSymbols.push(this._typeChecker.getTypeAtLocation(arg).symbol); });

          // Casting from: Use site symbol, to: actual parameter type
          paramSymbols.forEach((sym, i) => { this._recordCast(sym, argsSymbols[i]); });

          this._preprocessVisitChildren(node);
          break;
        }
      }
      case ts.SyntaxKind.VariableDeclaration: {
        let varDecl = <ts.VariableDeclaration>node;
        if (varDecl.initializer && varDecl.type) {
          let varDeclTypeSymbol = this._typeChecker.getTypeAtLocation(varDecl.type).symbol;
          let initTypeSymbol = this._typeChecker.getTypeAtLocation(varDecl.initializer).symbol;

          // Casting from: initializer's type symbol, to: actual variable declaration's annotated
          // type
          this._recordCast(initTypeSymbol, varDeclTypeSymbol);
        }
        this._preprocessVisitChildren(node);
        break;
      }
      case ts.SyntaxKind.ReturnStatement: {
        // check if there is an expression on the return statement since it's optional
        if (node.parent.kind !== ts.SyntaxKind.SourceFile &&
            (<ts.ReturnStatement>node).expression) {
          let symbolReturn =
              this._typeChecker.getTypeAtLocation((<ts.ReturnStatement>node).expression).symbol;

          let methodDeclAncestor = this._getAncestor(node, ts.SyntaxKind.MethodDeclaration);
          let funcDeclAncestor = this._getAncestor(node, ts.SyntaxKind.FunctionDeclaration);
          let ancestor;

          // early exit if no ancestor that is method or function declaration
          if (!methodDeclAncestor && !funcDeclAncestor) {
            this._preprocessVisitChildren(node);
            break;
          }

          // if node has method declaration, parent is method declaration
          if (methodDeclAncestor) {
            ancestor = methodDeclAncestor;
          }

          // if node has function declaration, parent is function declaration
          if (funcDeclAncestor) {
            ancestor = funcDeclAncestor;
          }

          let funcLikeDecl = <ts.FunctionLikeDeclaration>ancestor;

          // if there is no type information, return early
          if (!funcLikeDecl.type) {
            this._preprocessVisitChildren(node);
            break;
          }

          // if there is no typeName, return early
          if ((<ts.TypeReferenceNode>funcLikeDecl.type).typeName) {
            let funcLikeDeclSymbol = this._typeChecker.getSymbolAtLocation(
                (<ts.TypeReferenceNode>funcLikeDecl.type).typeName);
            // Casting from: return expression's type symbol, to: actual function/method
            // declaration's return type
            this._recordCast(symbolReturn, funcLikeDeclSymbol);
          }
        }

        this._preprocessVisitChildren(node);
        break;
      }
      default: {
        this._preprocessVisitChildren(node);
        break;
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
        output += pae.dotToken.getFullText();

        // if LHS is a module, do not rename property name
        var lhsTypeSymbol = this._typeChecker.getTypeAtLocation(pae.expression).symbol;
        var lhsIsModule = lhsTypeSymbol && ts.SymbolFlags.ValueModule === lhsTypeSymbol.flags;

        // Early exit when exprSymbol is undefined.
        if (!exprSymbol) {
          this.reportError(pae.name, 'Symbol information could not be extracted.\n');
          return;
        }

        var isExternal = this.isExternal(exprSymbol);
        if (!this.isRenameable(lhsTypeSymbol) || isExternal || lhsIsModule) {
          return output + this._ident(pae.name);
        }
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
      case ts.SyntaxKind.PropertySignature: {
        if (node.parent.kind === ts.SyntaxKind.TypeLiteral ||
            node.parent.kind === ts.SyntaxKind.InterfaceDeclaration) {
          let parentSymbol = this._typeChecker.getTypeAtLocation(node.parent).symbol;
          let rename = this.isRenameable(parentSymbol);
          return this.contextEmit(
              node, rename);
        }
        return this.contextEmit(node);
      }
      // All have same wanted behavior.
      case ts.SyntaxKind.MethodDeclaration:
      case ts.SyntaxKind.PropertyAssignment:
      case ts.SyntaxKind.PropertyDeclaration: {
        let parentTypeSymbol = this._typeChecker.getTypeAtLocation(node.parent).symbol;
        let renameable = this.isRenameable(parentTypeSymbol);
        return this.contextEmit(node, renameable);
      }
      default: { return this.contextEmit(node); }
    }
  }

  // if renameIdent is true, rename children identifiers in this node
  private contextEmit(node: ts.Node, renameIdent: boolean = false) {
    // The indicies of nodeText range from 0 ... nodeText.length - 1. However, the start and end
    // positions of nodeText that .getStart() and .getEnd() return are relative to
    // the entire sourcefile.
    let nodeText = node.getFullText();
    let children = node.getChildren();
    let output = '';
    // prevEnd is used to keep track of how much of nodeText has been copied over. It is updated
    // within the for loop below, and text from nodeText(0, prevEnd), including children text
    // that fall within the range, has already been copied over to output.
    let prevEnd = 0;
    let nameChildNode = (<any>node).name;
    // Loop-invariant: prevEnd should always be less than or equal to the start position of
    // an unvisited child node because the text before a child's text must be copied over to
    // the new output before anything else.
    children.forEach((child) => {
      // The start and end positions of the child's text must be updated so that they
      // are relative to the indicies of the parent's text range (0 ... nodeText.length - 1), by
      // off-setting by the value of the parent's start position. Now childStart and childEnd
      // are relative to the range of (0 ... nodeText.length).
      let childStart = child.getFullStart() - node.getFullStart();
      let childEnd = child.getEnd() - node.getFullStart();
      output += nodeText.substring(prevEnd, childStart);
      let childText = '';
      if (renameIdent && child === nameChildNode && child.kind === ts.SyntaxKind.Identifier) {
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

  // rename the identifier, but retain comments/spacing since we are using getFullText();
  private _renameIdent(node: ts.Node) {
    let fullText = node.getFullText();
    let fullStart = node.getFullStart();
    let regStart = node.getStart() - fullStart;
    let preIdent = fullText.substring(0, regStart);
    return preIdent + this.renameProperty(node.getText());
  }

  private _ident(node: ts.Node) { return node.getFullText(); }

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