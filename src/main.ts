///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript/typescript.d.ts"/>

import * as ts from 'typescript';
import * as fs from 'fs'; // filesystem module
// import * as fsx from 'fs-extra/';
import * as util from 'util';
import * as path from 'path';

/* TranspilerOptions Class will go here */

const DEBUG = true;

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES6,
  experimentalDecorators: true
};

export function ident(n: ts.Node): string {
  if (n.kind === ts.SyntaxKind.Identifier) return (<ts.Identifier>n).text;
  if (n.kind === ts.SyntaxKind.QualifiedName) {
    var qname = (<ts.QualifiedName>n);
    var leftName = ident(qname.left);
    if (leftName) return leftName + '.' + ident(qname.right);
  } /* Not sure what a qualified name is */
  return null;
}

/* The Transpiler Class */
export class Transpiler {
  private output: Output;
  private currentFile: ts.SourceFile;
  private typeChecker: ts.TypeChecker;

  /*
   * "Stupid Mode" will rename properties indiscriminantly. If anything is named "foo", it will be
   * renamed to global new name for "foo".
   */
  stupidMode: boolean;

  /* 
   * List of properties, and their remappings. Key is the property name, value is a PropertyInfo 
   * object which has what type its parent is (left hand side expression) and its new name. 
   */
  renameMap = new Map();
  /* 
   * List of "root" names, and the last property name assigned to one of its properties.
   * ie: Foo is a class. Foo has properties x, y, z which were renamed to a, b, c. 
   * { Foo: 'c' } allows easy access to Foo's last renamed property so we can use 
   * getNextLateralPropertyName per Class/"root".
   */
  prevNameMap = new Map();

  /* For "stupid mode" */
  prevName: string = '';
  
  /* Not sure if needed */
  nodes: ts.Node[] = [];

  /* Not needed as of now */
  private errors: string[] = [];

  constructor() {
    /* nothing here yet */
  } 

  emit(s: string) { 
    if (DEBUG) console.log('emit called!\n');
    this.output.emit(s); 
  }

  /* return set options for the compiler */
  getCompilerOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      allowNonTsExtensions: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES6,
    };
    return options;
  }

  createCompilerHost(): ts.CompilerHost {

    var defaultLibFileName = ts.getDefaultLibFileName(this.getCompilerOptions());

    /* the methods of a compiler host object */
    return {
      getSourceFile: (sourceName, languageVersion) => {
        var path = sourceName;
        if (sourceName === defaultLibFileName) {
          path = ts.getDefaultLibFilePath(this.getCompilerOptions());
        }
        /* TODO LOOK INTO THIS */
        if (!fs.existsSync(path)) {
          console.log('path: ' + path);
          if (DEBUG) console.log('DNE :C\n');
          return undefined;
        }
        var contents = fs.readFileSync(path, 'UTF-8');
        return ts.createSourceFile(sourceName, contents, this.getCompilerOptions().target, true);
      },
      // these are not used; just exist to satisfy interface.
      writeFile: function(name, text, writeByteOrderMark, outputs) {
        fs.writeFile(name, text);
      },
      getDefaultLibFileName: function() { return defaultLibFileName; },
      useCaseSensitiveFileNames: function() { return true; },
      getCanonicalFileName: function(filename) { return filename; },
      getCurrentDirectory: function() { return ""; },
      getNewLine: function() { return "\n"; }
    };
  }

  /*
   * TODO: We want to take the filenames and output the 
   * renamed files in the same directory (for now). 
   * Therefore, destination parameter is un-needed.
   *
   * TODO: Error checking / Error Reporting 
   */
  transpile(fileNames: string[], destination?: string): void {
    var host = this.createCompilerHost();       
    var program = ts.createProgram(fileNames, this.getCompilerOptions(), host);
    var typeChecker = program.getTypeChecker(); /* Where should this happen? */

    // Only write files that were explicitly passed in.
    var fileMap: {[s: string]: boolean} = {};
    fileNames.forEach((f) => fileMap[this.normalizeSlashes(f)] = true);

    this.errors = [];
    program.getSourceFiles()
        .filter((sourceFile) => fileMap[sourceFile.fileName])
        // Do not generate output for .d.ts files.
        .filter((sourceFile: ts.SourceFile) => !sourceFile.fileName.match(/\.d\.ts$/))
        .forEach((f: ts.SourceFile) => {
          this.getNodeKindInfo(f);
          var renamedCode = this.translate(f, typeChecker); 
          var outputFile = this.getOutputPath(f.fileName);
          //fsx.mkdirsSync(path.dirname(outputFile));
          fs.writeFileSync(outputFile, renamedCode);
        });
    /* TODO: Implmenent checkForErrors */
    /* this.checkForErrors(program); */
  }

  /* Walk the AST of the program */
  /* Pass in typechecker instead of program */
  walk(sourcefile: ts.SourceFile, typeChecker: ts.TypeChecker) {
    this.currentFile = sourcefile;
    this.traverse(sourcefile);
    this.printMap(this.renameMap);
  }

  /* 
   * VISITOR PATTERN: Emitting output 
   */
  visit(node: ts.Node, indent?: number) {
    var _this = this;
    switch (node.kind) {
      case ts.SyntaxKind.ExportKeyword:
        if (DEBUG) console.log('export keyword');
        _this.emit('export ');
        break;
      case ts.SyntaxKind.ClassDeclaration:
        var cd = <ts.ClassDeclaration>node;
        if (DEBUG) console.log(cd);
        visitClassLike('class ', cd);
        break;
      case ts.SyntaxKind.VariableStatement:
        if (DEBUG) console.log('Variable Statement');
        var vs = <ts.VariableStatement>node;
        _this.visit(vs.declarationList);
        _this.emit(';\n');
        break;
      case ts.SyntaxKind.VariableDeclarationList:
        // Note from Martin: VariableDeclarationList can only occur as part of a for loop.
        var varDeclList = <ts.VariableDeclarationList>node;
        if (DEBUG) console.log('variable declaration list');
        /* Visit list of variable declarations */
        varDeclList.declarations.forEach(function(decl){
          _this.visit(decl);
        });
        break;
      case ts.SyntaxKind.VariableDeclaration:
        if (DEBUG) console.log('variable declaration!');
        var vd = <ts.VariableDeclaration>node;
        if (DEBUG) console.log(vd);
        _this.emit('var ');
        _this.visit(vd.name);
        if (vd.type) {
          _this.emit(': ' + vd.type.getText());
        }

        if (vd.initializer) {
          _this.emit(' = ');
          if (DEBUG) console.log(vd.initializer.kind + ' ' + ts.SyntaxKind[vd.initializer.kind]);
          /* New Expression */
          _this.visit(vd.initializer);
        }

        break;
      case ts.SyntaxKind.PropertyAssignment:
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        var pd = <ts.PropertyDeclaration>node;
        if (DEBUG) console.log('propertydeclaration!');
        visitProperty(pd);
        break;
      case ts.SyntaxKind.Parameter:
        var param = <ts.ParameterDeclaration>node;
        break;
      case ts.SyntaxKind.Constructor:
        if (DEBUG) console.log('constructor!');
        var constructor = <ts.ConstructorDeclaration>node;
        visitConstructor(constructor);
        break;
      case ts.SyntaxKind.Block:
        if (DEBUG) console.log('block!');
        var block = <ts.Block>node;
        visitBlock(block);
        break;
      case ts.SyntaxKind.NewExpression:
        if (DEBUG) console.log('new expression');
        var newExp = <ts.NewExpression>node;
        if (DEBUG) console.log(newExp);
        
        var lhs = newExp.expression;
        var typeArgs = newExp.typeArguments;
        var args = newExp.arguments;

        _this.emit('new ');
        _this.visit(lhs);
        _this.emit('(');

        /* TODO: Differentiate between TypeArgs and Args */
        /* TODO: Create a 'second-to-last'? */
        var argSize = args.length;
        args.forEach(function(arg, i) {
          if (DEBUG) console.log(arg);
          _this.visit(arg);
          if (i < argSize - 1) {
            _this.emit(', ');
          }
        });

        _this.emit(')');

        break;
      case ts.SyntaxKind.ExpressionStatement:
        if (DEBUG) console.log('expression statement!');
        var es = <ts.ExpressionStatement>node;
        if (DEBUG) console.log(ts.SyntaxKind[es.expression.kind]);
        _this.visit(es.expression);
        break;
      case ts.SyntaxKind.BinaryExpression:
        if (DEBUG) console.log('binary expression!');
        var be = <ts.BinaryExpression>node;
        var left = be.left;
        var operator = be.operatorToken;
        var right = be.right;

        if (DEBUG) console.log('left ' +  ts.SyntaxKind[left.kind]);
        if (DEBUG) console.log('right ' + ts.SyntaxKind[right.kind])
             
        _this.visit(left);
        _this.emit(' ' + operator.getText() + ' ');
        _this.visit(right);

        break;
      case ts.SyntaxKind.MethodDeclaration:
        var md = <ts.MethodDeclaration>node;
        if (DEBUG) console.log('MethodDeclaration!');
        visitFunctionLike(md);
        break;
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        break;
      /* Always has .text */
      /* we visit the property and add it to the dictionary */
      case ts.SyntaxKind.Identifier:
        var id = <ts.Identifier>node;
        if (DEBUG) console.log('identifier!');
        visitTypeName(id);
        break;
      case ts.SyntaxKind.DotToken:
        _this.emit('.');
        break;
      case ts.SyntaxKind.ThisKeyword:
        _this.emit('this');
        break;
      case ts.SyntaxKind.StringLiteral:
        var sl = <ts.StringLiteral>node;
        if (DEBUG) console.log('String literal!');
        _this.emit(sl.getText());
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        var pae = <ts.PropertyAccessExpression>node;
        var lhs = pae.expression;
        var name = pae.name;

        /* Undefined, so break */
        if (!lhs) { break; }

        if (DEBUG) console.log(ts.SyntaxKind[lhs.kind]);
        _this.visit(lhs);
        _this.visit(pae.dotToken);
        _this.visit(name);

        /* TODO: Explore when to put ;\n */
        if (pae.parent.kind === ts.SyntaxKind.ExpressionStatement) {
          _this.emit(';\n');
        }
        break;
      case ts.SyntaxKind.ReturnStatement:
        if (DEBUG) console.log('Return Statement!');
        var rs = <ts.ReturnStatement>node;
        _this.emit('return');

        if (rs.expression) {
          _this.emit(' ');
          _this.visit(rs.expression);
        }
        break;
    }

    function visitClassLike(keyword: string, decl: ts.ClassDeclaration) {


      /* TODO: Visit decorators*/
      /* ... */

      if (DEBUG) console.log(decl.modifiers);
      if (decl.modifiers) {
        decl.modifiers.forEach(function(mod) {
          _this.visit(mod);
        });
      }

      _this.emit(keyword);

      visitTypeName(decl.name);

      /* TODO: Visit type name */
      /* .... */

      _this.emit(' {\n');

      if (DEBUG) console.log(decl);
      decl.members.forEach(function(memb) {
        // if (DEBUG) console.log(memb);
        // if (DEBUG) console.log(memb.kind + ': ' + ts.SyntaxKind[memb.kind]);
        _this.visit(memb);
      });

      /* Go through property parameters here, think about public and private properties */
      /* Visit constructor declaration */
      /* Method declarations - function-like */

      _this.emit('}\n');
    }

    function visitConstructor(cd: ts.ConstructorDeclaration) {
      if (DEBUG) console.log('visitConstructor');

      if (DEBUG) console.log(cd);

      _this.emit('constructor (');

      var params = cd.parameters;
      var paramsSize = params.length;

      /* VISIT PARAMETERS */
      /* TODO: Abstract this logic to one function. */
      /* Keep track when to insert a comma between parameters */
      params.forEach(function(param, i) {
        _this.visit(param.name);
        if (i < paramsSize - 1) _this.emit(', ');
      });

      _this.emit(')');

      /* Constructor stuff yay */
      _this.emit('{\n');

      /* Visit body of constructor */
      _this.visit(cd.body);

      _this.emit('}\n');
    }

    function visitTypeName(typeName: ts.EntityName) {
      if (typeName.kind !== ts.SyntaxKind.Identifier) {
        _this.visit(typeName);
        return;
      }
      var identifier = ident(typeName);
      if (_this.renameMap.get(identifier)) {
        identifier = _this.renameMap.get(identifier);
      }
      _this.emit(identifier);
    }

    function visitFunctionLike(fn: ts.FunctionLikeDeclaration, accessor?: string) {
      if (DEBUG) console.log('visitFunctionLike');
      if (DEBUG) console.log(fn);

      /* TODO: Visit Decorators */
      /* .... */

      _this.visit(fn.name);

      _this.emit('(');

      /* TODO: Look at Method parameter declaration */
      /* ... */
      fn.parameters.forEach(function(param) {
        _this.visit(param);
      });

      _this.emit(')');

      /* TODO: Look and see if return type information exists */
      /* .... */

      _this.emit(' {\n');

      /* visit body of method declaration */
      _this.visit(fn.body);

      _this.emit('}\n');


      /* TODO */  
      // if (fn.type) {
      //   if (fn.kind === ts.SyntaxKind.ArrowFunction) {
      //     // Type is silently dropped for arrow functions, not supported in Dart.
      //     this.emit('/*');
      //     this.visit(fn.type);
      //     this.emit('*/');
      //   } else {
      //     this.visit(fn.type);
      //   }
      // }
      // if (accessor) this.emit(accessor);
      // if (fn.name) this.visit(fn.name);
      // // Dart does not even allow the parens of an empty param list on getter
      // if (accessor !== 'get') {
      //   this.visitParameters(fn.parameters);
      // } else {
      //   if (fn.parameters && fn.parameters.length > 0) {
      //     this.reportError(fn, 'getter should not accept parameters');
      //   }
      // }
      // if (fn.body) {
      //   this.visit(fn.body);
      // } else {
      //   this.emit(';');
      // }
    }  

    /* This can probably also apply to ParameterDeclaration */
    function visitProperty(pd: ts.PropertyDeclaration) {
      if (DEBUG) console.log('visitProperty');
      _this.visit(pd.name);
      if (pd.questionToken) {
        _this.emit('?');
      }
      if (pd.type) {
        var _type = pd.type.getText();
        _this.emit(': ' + _type);
      }
      _this.emit(';\n');
    }

    function visitBlock(block: ts.Block) {
      if (DEBUG) console.log('visitBlock');
      block.statements.forEach(function(statement) {
        if (DEBUG) console.log(ts.SyntaxKind[statement.kind]);
        _this.visit(statement);
        _this.emit(';\n');
      });
    }

    function visitExpression(expression: ts.Expression) {
    }

    function visitStatement(statement: ts.Statement) {
      if (DEBUG) console.log('visitStatement');
      if (DEBUG) console.log(statement);
    }
  }

  /* Somewhat of a misnomer to refer to pString as "parent" */
  /* typeChecker: ts.TypeChecker, pString: string */
  traverse(node: ts.Node, typeChecker?: ts.TypeChecker, pString?: string) {
    if (DEBUG) console.log(node.kind + ': ' + ts.SyntaxKind[node.kind]);
    var _this = this;
    switch (node.kind) {
      case ts.SyntaxKind.SourceFile:
        break;
      case ts.SyntaxKind.ClassDeclaration:
        var cd = <ts.ClassDeclaration>node;
        break;
      case ts.SyntaxKind.PropertyAssignment:
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        var pd = <ts.PropertyDeclaration>node;
        break;
      case ts.SyntaxKind.Parameter:
        var param = <ts.ParameterDeclaration>node;
        break;
      case ts.SyntaxKind.Constructor:
        var constructor = <ts.ConstructorDeclaration>node;
        break;
      case ts.SyntaxKind.MethodDeclaration:
        break;
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        break;
      case ts.SyntaxKind.BinaryExpression:
        break;
      /* Always has .text */
      /* we rename the property and add it to the dictionary */
      case ts.SyntaxKind.Identifier:
        var id = <ts.Identifier>node;
        var enumKind = id.parent.kind;
        if (DEBUG) console.log('gparent: ' + ts.SyntaxKind[id.parent.parent.kind]);
        if (DEBUG) console.log('parent: ' + ts.SyntaxKind[enumKind]);
        if (DEBUG) console.log('id.text ' + id.text);
        if (DEBUG) console.log('=============================');
        if (id.parent.kind === ts.SyntaxKind.PropertyDeclaration && 
          id.parent.parent.kind === ts.SyntaxKind.ClassDeclaration) {
          /* Add to rename map */
          _this.assignNewPropertyName(id.text);
        }
        break;
      case ts.SyntaxKind.DotToken:
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        var pae = <ts.PropertyAccessExpression>node;
        var lhs = pae.expression;
        break;
    }

    ts.forEachChild(node, function(node) {
      _this.traverse(node);
    });
  }

  getType(node: ts.Node, typeChecker: ts.TypeChecker): string {
    try {
      if (DEBUG) console.log("TYPECHECKER");
      if (DEBUG) console.log(typeChecker.typeToString(typeChecker.getTypeAtLocation(node)));
      return typeChecker.typeToString(typeChecker.getTypeAtLocation(node));
    } catch(error) {
      if (DEBUG) console.log("TYPECHECKER ERROR " + error.stack);
      return "error";
    }
  }

  printMap(map: Map<any, any>) {
    if (DEBUG) console.log('============ Rename Map ===============');
    map.forEach(function(value, key) {
      if (DEBUG) console.log(key + " = " + value);
    }, map);
    if (DEBUG) console.log('============ Rename Map ===============');
  }

  /* Concat the 'parent' and 'child' strings */
  updateParentString(p: string, c: string): string {
    if (p.length === 0) {
      return c;
    } else if (c.length === 0) {
      return p;
    } else {
      return p + '$' + c;
    }
  }

  /* 
   * Given a char, generate the next character in the alphabet.
   */
  nextChar(c: string): string {
    return String.fromCharCode(c.charCodeAt(0) + 1);
  }

  /* Given the last code, returns a string for the new property name        */
  /* Ie: given 'a', will return 'b', given 'az', will return 'ba', etc. ... */
  generateNextLateralPropertyName(code: string): string {
    var chars = code.split('');
    var len: number = code.length;

    if (len === 0) {
      return 'a';
    }

    var last: string = chars[len - 1];

    /* Grab the next letter using nextChar */
    for (var i = len - 1; i >= 0; i--) {
      if (chars[i] !== 'z') {
        chars[i] = this.nextChar(chars[i]);
        break;
      } else {
        chars[i] = 'a';
        if (i === 0) {
          return 'a' + (chars.join(''));             
        }
      }
    }
    return chars.join('');
  }  

  /* Given a key, assign a generated property shortname */
  assignNewPropertyName(propName: string, lhsType?: string): void {

    if (this.stupidMode) {
      var newName = this.generateNextLateralPropertyName(this.prevName);
      if (!this.renameMap.get(propName)) {
        this.renameMap.set(propName, newName);
        this.prevName = newName;
      } // else do nothing, this re-mapping already exists

    } else {
      var prevRename = this.getLastRename(lhsType);
      var newPropName = this.generateNextLateralPropertyName(prevRename);
      var value = new PropertyInfo(lhsType, newPropName);
      /* 
       * Add the PropertyInfo for the property name in a new list since this property name might
       * not be unique.
       */
      if (!this.renameMap.get(propName)) {
        this.renameMap.set(propName, [value]);
      } else {
        var arr = this.renameMap.get(propName);
        this.renameMap.set(propName, arr.push(value));
      }
      this.updateLastRename(lhsType, newPropName);
    }
  }

  /* Update the last renamed property for the lhs expression */
  private updateLastRename(key: string, rename: string): void {
    this.prevNameMap.set(key, rename);
  }

  private getLastRename(key: string): string {
    /*
     * This LHS expression does not exist yet. Add it to the prevNameMap.
     */
    if (!this.prevNameMap.get(key)) {
      /* 
       * Set initial last property name to '' so 'a' can be generated correctly since
       * generateNextLateralPropertyName is based on the most recently generated name.
       */
      this.prevNameMap.set(key, '');
      return '';
    } else {
      return this.prevNameMap.get(key);
    }
  }

  private normalizeSlashes(path: string) { return path.replace(/\\/g, "/"); }

  getOutputPath(filePath: string): string {
    var parsedFile = path.parse(filePath);
    var renamedFile = parsedFile.dir + '/' + parsedFile.name + '_renamed' + parsedFile.ext;
    return renamedFile;
  }

  /* Visible for debugging */
  getOutput() { return this.output.getResult(); }

  translate(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): string {
    this.currentFile = sourceFile;
    this.typeChecker = typeChecker;
    this.output = new Output();
    /* Walk to create rename dictionary */
    this.walk(sourceFile, typeChecker);
    var _this = this;

    /* Figure out a different entry point to rename */
    ts.forEachChild(sourceFile, function(node) {
      _this.visit(node);
    });

    return this.getOutput();
  }

  private getNodeKindInfo(sourceFile: ts.Node) {
    var _this = this;
    ts.forEachChild(sourceFile, function(node) {
      if (DEBUG) console.log(ts.SyntaxKind[node.kind] + ': ' + node.kind);
      _this.getNodeKindInfo(node);
    });
  }

  translateProgram(program: ts.Program): {[path: string]: string} {
    var paths: {[path: string]: string} = {};
    var typeChecker = program.getTypeChecker();
    this.errors = [];
    program.getSourceFiles()
        .filter((sourceFile: ts.SourceFile) => (!sourceFile.fileName.match(/\.d\.ts$/) &&
                                                !!sourceFile.fileName.match(/\.[jt]s$/)))
        .forEach((f) => paths[f.fileName] = this.translate(f, typeChecker));
    /* TODO: Error checking */
    return paths;
  }

}

/*
 * Holds information about a property added to the rename map. 
 * Should this also have a field for the property's type?
 * This is needed for "smart mode".
 */
class PropertyInfo {
  private lhs: string;
  private newName: string;

  constructor(lhs: string, newName: string) {
    this.lhs = lhs;
    this.newName = newName;
  }

  getLHS(): string {
    return this.lhs;
  }

  getNewName(): string {
    return this.newName;
  }
}

class Output {
  private result: string = '';
  private column: number = 1;
  private line: number = 1;
  private indentSize: number = 2;

  constructor(/* private currentFile: ts.SourceFile, private relativeFileName: string */) {}

  emit(str: string, indent?: number) {
    this.emitIndent(indent);
    this.emitNoSpace('');
    this.emitNoSpace(str);
  }

  emitIndent(indent?: number) {
    if (!indent) return;

    for (var i = 1; i <= indent * this.indentSize; i++) {
      this.result += ' ';
    }
  }

  emitNoSpace(str: string) {
    this.result += str;
    for (var i = 0; i < str.length; i++) {
      if (str[i] === '\n') {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
    }
  }

  getResult(): string { return this.result; }
}

var transpiler = new Transpiler();
transpiler.stupidMode = true;  // Figure out a way to set this. 
transpiler.transpile(['../../test/input/basic_greeter.ts']);

